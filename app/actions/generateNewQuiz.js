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

/* -------- SERVER ACTION -------- */

export async function generateNewQuiz(memoryId) {
  try {
    await connectDB();

    const memory = await Memory.findById(memoryId).lean();
    if (!memory) throw new Error("Memory not found");

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    const prompt = `
Generate EXACTLY 5 multiple-choice questions.

Rules:
- correctAnswer MUST exactly match one option string
- No A/B/C/D letters
- Return ONLY JSON (no explanation, no markdown)

Format:
[
  {
    "question": "Question text",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": "Option 1",
    "explanation": "Short explanation"
  }
]

Text:
${memory.extractedText.slice(0, 30_000)}
`;

    const result = await model.generateContent(prompt);
    const questions = extractJsonArraySafe(result.response.text());

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Invalid quiz format");
    }

    return { success: true, questions };

  } catch (err) {
    console.error("Generate Quiz Error:", err);
    return { success: false, error: err.message };
  }
}
