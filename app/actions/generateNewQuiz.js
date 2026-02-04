"use server";

import connectDB from '@/lib/db';
import Memory from '@/models/Memory';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateNewQuiz(memoryId) {
  try {
    await connectDB();
    const memory = await Memory.findById(memoryId);

    if (!memory) throw new Error("Memory not found");

    // Note: Using 'gemini-1.5-flash' or 'gemini-2.0-flash' as 2.5 does not exist yet
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert tutor. Based on the text below, generate 5 BRAND NEW, unique multiple-choice questions.
      
      CRITICAL: The "correctAnswer" MUST be the exact string text from the "options" array. 
      Do NOT use "A", "B", "C", or "D". Use the full text of the correct choice.
      
      Return ONLY valid JSON. Structure:
      [
        {
          "question": "Question text?",
          "options": ["Full Option 1", "Full Option 2", "Full Option 3", "Full Option 4"],
          "correctAnswer": "Full Option 1",
          "explanation": "Why this specific option is correct."
        }
      ]

      Text: ${memory.extractedText.substring(0, 30000)}
    `;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    const cleanedJson = textResponse.replace(/```json|```/g, '').trim();
    
    const newQuestions = JSON.parse(cleanedJson);

    return { success: true, questions: newQuestions };

  } catch (error) {
    console.error("Error generating new quiz:", error);
    return { success: false, error: "Failed to generate new questions" };
  }
}