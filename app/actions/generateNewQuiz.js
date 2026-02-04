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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Prompt specifically for 5 NEW questions
    const prompt = `
      You are an expert tutor. Based on the text below, generate 5 BRAND NEW, unique multiple-choice questions.
      Make them different from generic questions. Focus on details.
      
      Return ONLY valid JSON. Structure:
      [
        {
          "question": "Question text?",
          "options": ["A", "B", "C", "D"],
          "correctAnswer": "A",
          "explanation": "Why A is correct."
        }
      ]

      Text: ${memory.extractedText.substring(0, 30000)}
    `;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    const cleanedJson = textResponse.replace(/```json|```/g, '').trim();
    
    const newQuestions = JSON.parse(cleanedJson);

    // Optional: Save these to DB if you want history, 
    // for now we just return them to the UI.
    return { success: true, questions: newQuestions };

  } catch (error) {
    console.error("Error generating new quiz:", error);
    return { success: false, error: "Failed to generate new questions" };
  }
}