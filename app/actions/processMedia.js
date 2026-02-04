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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_AI_CHARS = 20_000;

/* ---------------- HELPERS ---------------- */

function extractJsonObjectSafe(text) {
  if (!text) throw new Error("Empty AI response");
  // Remove markdown code blocks if present
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/); // Find first JSON object
  if (!match) throw new Error("No JSON object found");
  return JSON.parse(match[0]);
}

function extractJsonArraySafe(text) {
  if (!text) throw new Error("Empty AI response");
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/); // Find first JSON array
  if (!match) throw new Error("No JSON array found");
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

/**
 * Normalizes quiz items. 
 * Ensures valid options, corrects Answer mapping, and preserves difficulty.
 */
function normalizeQuiz(quiz = []) {
  if (!Array.isArray(quiz)) return [];

  return quiz.map((q) => {
    if (!q?.question || !Array.isArray(q.options)) return null;

    const options = q.options.map((o) => String(o).trim());
    let correct = (q.correctAnswer || "").toString().trim();

    // Case 1: correctAnswer is "A", "B", etc.
    if (/^[A-D]$/i.test(correct)) {
      const index = correct.toUpperCase().charCodeAt(0) - 65;
      correct = options[index] ?? options[0];
    }

    // Case 2: fuzzy match text
    const matchedOption =
      options.find((opt) => opt.toLowerCase() === correct.toLowerCase()) ||
      options.find((opt) => opt.toLowerCase().includes(correct.toLowerCase()));

    return {
      question: q.question.trim(),
      options,
      correctAnswer: matchedOption || options[0], // fallback safe
      explanation: q.explanation?.trim() || "",
      difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
    };
  }).filter(Boolean);
}

/**
 * Normalizes the complex numerical sets structure
 */
function normalizeNumericals(numericals = []) {
    if (!Array.isArray(numericals)) return [];
    
    return numericals.map(set => {
        if (!set.relatedFormula || !Array.isArray(set.problems)) return null;
        return {
            relatedFormula: set.relatedFormula,
            problems: normalizeQuiz(set.problems) // Reuse quiz normalization logic
        };
    }).filter(Boolean);
}


/* ---------------- MAIN EXPORTS ---------------- */

export async function processMedia(formData) {
  let tempFilePath = null;

  try {
    await connectDB();

    const file = formData.get("file");
    const type = formData.get("type");

    if (!file || typeof file.arrayBuffer !== "function") throw new Error("Invalid file");
    if (!["pdf", "video"].includes(type)) throw new Error("Invalid media type");
    if (file.size > MAX_FILE_SIZE) throw new Error("File too large");

    tempFilePath = await saveToTempFile(file);
    const uploadResult = await uploadToCloudinary(tempFilePath);

    // --- 1. Extraction Logic ---
    let extractedText = "";

    if (type === "pdf") {
      const buffer = await fs.promises.readFile(tempFilePath);
      const result = await extractText(new Uint8Array(buffer));
      extractedText = Array.isArray(result?.text) ? result.text.join(" ") : result?.text || "";
    }

    if (type === "video") {
      const { result } = await deepgram.listen.prerecorded.transcribeUrl(
        { url: uploadResult.secure_url },
        { model: "nova-2", smart_format: true }
      );
      extractedText = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    }

    extractedText = extractedText.trim() || "No readable text extracted.";

    if (tempFilePath) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
    }

    // --- 2. AI Generation Logic ---
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    let aiData = {
      summary: "Summary unavailable.",
      patterns: [],
      formulas: [],
      quiz: [],
      numericals: [],
      roadmap: [],
    };

    try {
      // The Prompt enforces the schema and difficulty distribution
      const prompt = `
Analyze the provided content and output valid JSON only.

STRUCTURE REQUIREMENTS:

1. **formulas**: Extract key mathematical formulas as objects { "expression": "E=mc^2", "description": "..." }.
2. **quiz**: Generate exactly 5 conceptual multiple-choice questions (Theory only, no calculations).
   - Difficulty distribution: **2 Easy, 2 Medium, 1 Hard**.
   - Tag each with "difficulty": "easy" | "medium" | "hard".
3. **numericals**: 
   - IF formulas are found: For EACH formula, create a set.
   - Inside each set, generate exactly 6 math problems using that formula.
   - Difficulty distribution per formula: **1 Easy, 4 Medium, 1 Hard**.
   - IF NO formulas: Return an empty array [].
4. **summary**: A concise summary.
5. **roadmap**: Learning steps.

JSON FORMAT:
{
  "summary": "...",
  "patterns": ["keyword1", "keyword2"],
  "formulas": [ 
    { "expression": "Formula string", "description": "What it calculates" } 
  ],
  "quiz": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "Exact string match of one option",
      "explanation": "...",
      "difficulty": "easy" 
    }
  ],
  "numericals": [
    {
      "relatedFormula": "F = m * a",
      "problems": [
         // 6 problems here (1 easy, 4 medium, 1 hard)
         { "question": "...", "options": [...], "correctAnswer": "...", "difficulty": "easy" }
      ]
    }
  ],
  "roadmap": [ { "step": 1, "title": "...", "description": "..." } ]
}

CONTENT TO ANALYZE:
${extractedText.slice(0, MAX_AI_CHARS)}
`;

      const aiResult = await generateWithRetry(model, prompt);
      aiData = extractJsonObjectSafe(aiResult.response.text());
    } catch (err) {
      console.error("AI Parse Error:", err);
      // We continue to save the file even if AI fails partial parsing
    }

    // --- 3. Database Save ---
    const memory = await Memory.create({
      title: file.name,
      mediaType: type,
      mediaUrl: uploadResult.secure_url,
      extractedText,
      summary: aiData.summary?.trim() || "Summary unavailable.",
      patterns: Array.isArray(aiData.patterns) ? aiData.patterns : [],
      
      // New Schema Fields
      formulas: Array.isArray(aiData.formulas) ? aiData.formulas : [],
      quiz: normalizeQuiz(aiData.quiz),
      numericals: normalizeNumericals(aiData.numericals),
      
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

export async function generateNewQuiz(memoryId) {
  try {
    await connectDB();

    const memory = await Memory.findById(memoryId).lean();
    if (!memory) throw new Error("Memory not found");

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    // Updated prompt to respect the 2 Easy, 2 Medium, 1 Hard rule
    const prompt = `
Generate EXACTLY 5 conceptual multiple-choice questions based on the text.

DIFFICULTY RULES:
- 2 Questions MUST be "easy"
- 2 Questions MUST be "medium"
- 1 Question MUST be "hard"

JSON FORMAT:
[
  {
    "question": "Question text",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": "Option 1",
    "explanation": "Short explanation",
    "difficulty": "easy"
  }
]

TEXT CONTENT:
${memory.extractedText.slice(0, 30_000)}
`;

    const result = await model.generateContent(prompt);
    const rawQuestions = extractJsonArraySafe(result.response.text());
    
    // Normalize to ensure safety and structure
    const questions = normalizeQuiz(rawQuestions);

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Invalid quiz format returned by AI");
    }

    return { success: true, questions };

  } catch (err) {
    console.error("Generate Quiz Error:", err);
    return { success: false, error: err.message };
  }
}