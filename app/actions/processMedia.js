"use server";

import { v2 as cloudinary } from "cloudinary";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@deepgram/sdk";
import { extractText } from "unpdf"; // ✨ Modern PDF parser
import connectDB from "@/lib/db";
import Memory from "@/models/Memory";

import fs from "fs";
import path from "path";
import os from "os";

/* ------------------------------------------------------------------ */
/* CONFIG                                                            */
/* ------------------------------------------------------------------ */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_AI_CHARS = 20_000;

/* ------------------------------------------------------------------ */
/* HELPERS                                                           */
/* ------------------------------------------------------------------ */

function extractJsonSafe(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI did not return valid JSON");
  return JSON.parse(match[0]);
}

async function generateWithRetry(model, prompt, retries = 3) {
  let lastError;
  for (let i = 1; i <= retries; i++) {
    try {
      return await model.generateContent(prompt);
    } catch (err) {
      lastError = err;
      if (err?.status >= 500) {
        console.warn(`Gemini retry ${i}/${retries}`);
        await new Promise((r) => setTimeout(r, 1500 * i));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function saveToTempFile(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
  const tempPath = path.join(os.tmpdir(), `upload_${Date.now()}_${safeName}`);
  await fs.promises.writeFile(tempPath, buffer);
  return tempPath;
}

function uploadToCloudinary(filePath) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(
      filePath,
      {
        resource_type: "auto",
        folder: "memory_palace",
        chunk_size: 6_000_000,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
  });
}

/* ------------------------------------------------------------------ */
/* MAIN SERVER ACTION                                                */
/* ------------------------------------------------------------------ */
export async function processMedia(formData) {
  let tempFilePath = null;

  try {
    console.log("1. Starting Processing...");
    await connectDB();

    const file = formData.get("file");
    const type = formData.get("type"); // pdf | video

    if (!file) throw new Error("No file provided");
    if (!["pdf", "video"].includes(type))
      throw new Error("Invalid media type");
    if (file.size > MAX_FILE_SIZE)
      throw new Error("File exceeds 10MB limit");

    console.log(`2. Saving ${file.name} to temp...`);
    tempFilePath = await saveToTempFile(file);

    console.log("3. Uploading to Cloudinary...");
    const uploadResult = await uploadToCloudinary(tempFilePath);
    console.log("4. Upload Complete:", uploadResult.secure_url);

    /* -------------------------------------------------- */
    /* TEXT EXTRACTION                                   */
    /* -------------------------------------------------- */
    let extractedText = "";

    if (type === "pdf") {
      console.log("5. Extracting Text from PDF with unpdf...");

      try {
        const buffer = await fs.promises.readFile(tempFilePath);
        const uint8 = new Uint8Array(buffer);

        const result = await extractText(uint8);

        if (typeof result.text === "string") {
          extractedText = result.text;
        } else if (Array.isArray(result.text)) {
          extractedText = result.text
            .map(t =>
              typeof t === "string"
                ? t
                : t?.str || t?.text || ""
            )
            .join(" ");
        }

        extractedText = extractedText.trim();

        if (!extractedText) {
          extractedText =
            "This PDF appears to be scanned or contains little readable text.";
        }

      } catch (err) {
        console.error("PDF extraction failed:", err);
        extractedText = "Failed to extract text from PDF.";
      }
    }




    if (type === "video") {
      console.log("5. Transcribing Video...");
      const { result, error } =
        await deepgram.listen.prerecorded.transcribeUrl(
          { url: uploadResult.secure_url },
          { model: "nova-2", smart_format: true }
        );

      if (error) throw new Error(error.message);
      extractedText = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    }

    /* Cleanup temp file early */
    if (tempFilePath) {
      await fs.promises.unlink(tempFilePath).catch(() => { });
      tempFilePath = null;
    }

    /* -------------------------------------------------- */
    /* AI GENERATION                                     */
    /* -------------------------------------------------- */
    console.log("6. Generating Intelligence...");

    // Using stable Gemini 2.0 Flash Lite model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    const prompt = `
Analyze the following content:

"${extractedText.slice(0, MAX_AI_CHARS)}"

Return ONLY valid JSON:

{
  "summary": "3 paragraph summary",
  "patterns": ["tag1","tag2","tag3","tag4","tag5"],
  "quiz": [
    {
      "question": "...",
      "options": ["A","B","C","D"],
      "correctAnswer": "A",
      "explanation": "..."
    }
  ],
  "roadmap": [
    { "step": 1, "title": "...", "description": "..." }
  ]
}
`;

    let aiData;
    try {
      const aiResult = await generateWithRetry(model, prompt);
      aiData = extractJsonSafe(aiResult.response.text());
    } catch (err) {
      console.error("AI failed, using fallback:", err);
      aiData = {
        summary: "AI service temporarily unavailable.",
        patterns: [],
        quiz: [],
        roadmap: [],
      };
    }

    /* -------------------------------------------------- */
    /* SAVE TO DB                                        */
    /* -------------------------------------------------- */
    console.log("7. Saving to DB...");

    const memory = await Memory.create({
      title: file.name,
      mediaType: type,
      mediaUrl: uploadResult.secure_url,
      extractedText,
      summary: aiData.summary,
      patterns: aiData.patterns,
      quiz: aiData.quiz,
      roadmap: aiData.roadmap,
    });

    return { success: true, id: memory._id.toString() };
  } catch (err) {
    console.error("Processing Error:", err);
    if (tempFilePath) {
      await fs.promises.unlink(tempFilePath).catch(() => { });
    }
    return { success: false, error: err.message };
  }
}