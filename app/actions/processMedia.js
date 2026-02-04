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
// ... (Keeping your imports and config exactly the same)

export async function processMedia(formData) {
  let tempFilePath = null;

  try {
    // ... (Your existing Cloudinary and Extraction logic remains identical)

    /* -------------------------------------------------- */
    /* AI GENERATION (Updated Prompt for String Matching) */
    /* -------------------------------------------------- */
    console.log("6. Generating Intelligence...");

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // Reverted to stable model name
    });

    const prompt = `
Analyze the following content:
"${extractedText.slice(0, MAX_AI_CHARS)}"

Return ONLY valid JSON.
CRITICAL: The "correctAnswer" MUST be the exact text string from one of the options in the "options" array.

{
  "summary": "3 paragraph summary",
  "patterns": ["tag1","tag2","tag3","tag4","tag5"],
  "quiz": [
    {
      "question": "What is the primary concept?",
      "options": ["Concept A", "Concept B", "Concept C", "Concept D"],
      "correctAnswer": "Concept A",
      "explanation": "Explanation text here."
    }
  ],
  "roadmap": [
    { "step": 1, "title": "...", "description": "..." }
  ]
}
`;

    // ... (Your existing AI parsing and DB saving logic remains identical)
    // The "memory" object will now store the full string in "correctAnswer"

    return { success: true, id: memory._id.toString() };
  } catch (err) {
    // ... (Your error cleanup remains identical)
  }
}