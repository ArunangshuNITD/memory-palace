"use server";

import { v2 as cloudinary } from "cloudinary";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@deepgram/sdk";
import { extractText } from "unpdf";
import connectDB from "@/lib/db";
import Memory from "@/models/Memory";

import fs from "fs";
import path from "path";
import os from "os";

/* ---------------- CONFIG ---------------- */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_AI_CHARS = 20_000;

/* ---------------- HELPERS ---------------- */

function extractJsonObjectSafe(text) {
  if (!text) throw new Error("Empty AI response");

  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);

  if (!match) throw new Error("No JSON object found");

  return JSON.parse(match[0]);
}

async function generateWithRetry(model, prompt, retries = 3) {
  let lastError;
  for (let i = 1; i <= retries; i++) {
    try {
      return await model.generateContent(prompt);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1000 * i));
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
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });
}

/* ---------------- MAIN SERVER ACTION ---------------- */
function normalizeQuiz(quiz = []) {
  if (!Array.isArray(quiz)) return [];

  return quiz.map((q) => {
    if (!q?.question || !Array.isArray(q.options)) return null;

    const options = q.options.map(o => o.trim());

    let correct = (q.correctAnswer || "").trim();

    // Case 1: correctAnswer is "A", "B", etc.
    if (/^[A-D]$/i.test(correct)) {
      const index = correct.toUpperCase().charCodeAt(0) - 65;
      correct = options[index] ?? options[0];
    }

    // Case 2: correctAnswer text loosely matches an option
    const matchedOption =
      options.find(opt =>
        opt.toLowerCase() === correct.toLowerCase()
      ) ||
      options.find(opt =>
        opt.toLowerCase().includes(correct.toLowerCase())
      );

    return {
      question: q.question.trim(),
      options,
      correctAnswer: matchedOption || options[0], // fallback safe
      explanation: q.explanation?.trim() || "",
    };
  }).filter(Boolean);
}

export async function processMedia(formData) {
  let tempFilePath = null;

  try {
    await connectDB();

    const file = formData.get("file");
    const type = formData.get("type");

    if (!file || typeof file.arrayBuffer !== "function") {
      throw new Error("Invalid file");
    }
    if (!["pdf", "video"].includes(type)) {
      throw new Error("Invalid media type");
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("File too large");
    }

    tempFilePath = await saveToTempFile(file);
    const uploadResult = await uploadToCloudinary(tempFilePath);

    let extractedText = "";

    if (type === "pdf") {
      const buffer = await fs.promises.readFile(tempFilePath);
      const result = await extractText(new Uint8Array(buffer));
      extractedText = Array.isArray(result?.text)
        ? result.text.join(" ")
        : result?.text || "";
    }

    if (type === "video") {
      const { result } =
        await deepgram.listen.prerecorded.transcribeUrl(
          { url: uploadResult.secure_url },
          { model: "nova-2", smart_format: true }
        );
      extractedText =
        result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    }

    extractedText = extractedText.trim() || "No readable text extracted.";

    if (tempFilePath) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    let aiData = {
      summary: "Summary unavailable.",
      patterns: [],
      quiz: [],
      roadmap: [],
    };

    try {
      const prompt = `
Analyze the following content and return ONLY valid JSON.

{
  "summary": "Clear concise explanation",
  "patterns": ["keyword1", "keyword2"],
  "quiz": [
    {
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "Must be EXACTLY one of the option strings"
      "explanation": "Why is correct"
    }
  ],
  "roadmap": [
    {
      "step": 1,
      "title": "Step title",
      "description": "What to learn"
    }
  ]
}

Content:
${extractedText.slice(0, MAX_AI_CHARS)}
`;

      const aiResult = await generateWithRetry(model, prompt);
      aiData = extractJsonObjectSafe(aiResult.response.text());
    } catch (err) {
      console.error("AI Parse Error:", err);
    }

    const memory = await Memory.create({
  title: file.name,
  mediaType: type,
  mediaUrl: uploadResult.secure_url,
  extractedText,
  summary: aiData.summary?.trim() || "Summary unavailable.",
  patterns: Array.isArray(aiData.patterns) ? aiData.patterns : [],
  quiz: normalizeQuiz(aiData.quiz),   // ✅ FIXED
  roadmap: Array.isArray(aiData.roadmap) ? aiData.roadmap : [],
});


    return { success: true, id: memory._id.toString() };

  } catch (err) {
    console.error("Processing Error:", err);
    if (tempFilePath) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
    }
    return { success: false, error: err.message };
  }
}
