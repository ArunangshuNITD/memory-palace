"use server";

import connectDB from "@/lib/db";
import Memory from "@/models/Memory";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/* -------- HELPERS -------- */

function extractJsonArraySafe(text) {
  if (!text) throw new Error("Empty AI response");

  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);

  if (!match) throw new Error("No JSON array found");

  return JSON.parse(match[0]);
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

    // Case 2: fuzzy match text (AI sometimes returns partial strings)
    const matchedOption =
      options.find((opt) => opt.toLowerCase() === correct.toLowerCase()) ||
      options.find((opt) => opt.toLowerCase().includes(correct.toLowerCase()));

    return {
      question: q.question.trim(),
      options,
      correctAnswer: matchedOption || options[0], // fallback safe
      explanation: q.explanation?.trim() || "",
      // Ensure difficulty is valid, default to medium if missing
      difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
    };
  }).filter(Boolean);
}

/* -------- SERVER ACTION -------- */

export async function generateNewQuiz(memoryId) {
  try {
    await connectDB();

    const memory = await Memory.findById(memoryId).lean();
    if (!memory) throw new Error("Memory not found");

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    // Updated Prompt: Enforces Difficulty Distribution & Schema
    const prompt = `
Generate EXACTLY 5 conceptual multiple-choice questions based on the text.

DIFFICULTY RULES:
- 2 Questions MUST be "easy"
- 2 Questions MUST be "medium"
- 1 Question MUST be "hard"

OUTPUT REQUIREMENTS:
- "correctAnswer" MUST exactly match one string from "options"
- Return ONLY valid JSON (no markdown, no backticks)

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
    
    // 1. Extract raw JSON
    const rawQuestions = extractJsonArraySafe(result.response.text());
    
    // 2. Normalize (fix options, answers, and validate difficulty)
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