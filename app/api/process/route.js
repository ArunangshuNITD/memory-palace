import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Memory from '@/models/Memory';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@deepgram/sdk';
import pdf from 'pdf-parse';

// Initialize AI Clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

/* ---------------- HELPERS ---------------- */

// Safe JSON extractor (handles markdown blocks)
function extractJsonObjectSafe(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/); // Find first JSON object
  if (!match) throw new Error("No JSON object found in AI response");
  return JSON.parse(match[0]);
}

// Normalizes quiz data (Fixes options and difficulty)
function normalizeQuiz(quiz = []) {
  if (!Array.isArray(quiz)) return [];
  return quiz.map((q) => {
    if (!q?.question || !Array.isArray(q.options)) return null;

    const options = q.options.map((o) => String(o).trim());
    let correct = (q.correctAnswer || "").toString().trim();

    // Fix: If answer is "A", map it to options[0]
    if (/^[A-D]$/i.test(correct)) {
      const index = correct.toUpperCase().charCodeAt(0) - 65;
      correct = options[index] ?? options[0];
    }

    // Fix: Ensure the correct answer string actually exists in options
    const matchedOption = options.find((opt) => opt.toLowerCase() === correct.toLowerCase()) || options[0];

    return {
      question: q.question.trim(),
      options,
      correctAnswer: matchedOption,
      explanation: q.explanation?.trim() || "",
      difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
    };
  }).filter(Boolean);
}

// Normalizes numerical sets
function normalizeNumericals(numericals = []) {
    if (!Array.isArray(numericals)) return [];
    return numericals.map(set => {
        if (!set.relatedFormula || !Array.isArray(set.problems)) return null;
        return {
            relatedFormula: set.relatedFormula,
            problems: normalizeQuiz(set.problems) // Reuse quiz logic
        };
    }).filter(Boolean);
}

/* ---------------- MAIN HANDLER ---------------- */

export async function POST(req) {
  try {
    // 1. Connect to Database
    await connectDB();
    
    // 2. Handle File Upload
    const formData = await req.formData();
    const file = formData.get('file');
    const fileType = formData.get('type'); // "video" or "pdf"

    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let extractedText = "";

    // 3. Extract Text
    console.log("🔍 Extracting text from", fileType);
    
    if (fileType === 'video') {
      const { result, error } = await deepgram.listen.prerecorded.transcribeFile(buffer, {
        model: "nova-2",
        smart_format: true,
        punctuate: true,
      });
      if (error) throw new Error("Deepgram error");
      extractedText = result.results.channels[0].alternatives[0].transcript;
    } 
    else if (fileType === 'pdf') {
      const pdfData = await pdf(buffer);
      extractedText = pdfData.text;
    }

    // Truncate text to fit context window if necessary
    extractedText = extractedText.substring(0, 30000);

    // 4. GENERATE AI CONTENT
    console.log("🧠 Sending to Gemini...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // UPDATED PROMPT: Now asks for Formulas, Numericals, Summary, and Roadmap
    const prompt = `
      You are an expert teacher. Analyze this text and return a valid JSON object.
      
      STRUCTURE REQUIREMENTS:
      1. **formulas**: Extract key mathematical formulas { "expression": "E=mc^2", "description": "..." }.
      2. **quiz**: Exactly 5 conceptual multiple-choice questions (Theory).
         - Difficulty: 2 Easy, 2 Medium, 1 Hard.
      3. **numericals**: 
         - IF formulas are found: Create a set for EACH formula.
         - Inside each set: Exactly 6 math problems (1 Easy, 4 Medium, 1 Hard).
         - IF NO formulas: Return empty array [].
      4. **summary**: Concise summary.
      5. **roadmap**: Learning steps.

      JSON FORMAT ONLY (No Markdown):
      {
        "summary": "...",
        "patterns": ["concept1", "concept2"],
        "formulas": [ { "expression": "...", "description": "..." } ],
        "quiz": [
          { "question": "...", "options": ["A","B","C","D"], "correctAnswer": "A", "difficulty": "medium", "explanation": "..." }
        ],
        "numericals": [
          {
            "relatedFormula": "F = m*a",
            "problems": [ ...same structure as quiz... ]
          }
        ],
        "roadmap": [ { "step": 1, "title": "...", "description": "..." } ]
      }
      
      Text to analyze:
      ${extractedText}
    `;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    
    // 5. Parse and Normalize Data
    let aiData;
    try {
        aiData = extractJsonObjectSafe(textResponse);
    } catch (e) {
        console.error("JSON Parse Error", e);
        // Fallback to basic object if AI fails completely
        aiData = { summary: "AI generation failed", quiz: [], formulas: [], numericals: [] };
    }

    // 6. SAVE TO DB (One-shot create)
    console.log("💾 Saving to MongoDB...");
    
    const newMemory = await Memory.create({
      title: file.name,
      mediaType: fileType,
      extractedText: extractedText,
      
      // Mapped Fields
      summary: aiData.summary || "",
      patterns: aiData.patterns || [],
      formulas: aiData.formulas || [],
      roadmap: aiData.roadmap || [],
      
      // Normalized Fields (Important for UI stability)
      quiz: normalizeQuiz(aiData.quiz),
      numericals: normalizeNumericals(aiData.numericals),
    });

    console.log("✅ Success! Memory ID:", newMemory._id);
    
    return NextResponse.json({ 
      success: true, 
      id: newMemory._id, 
      message: "Processing Complete" 
    });

  } catch (error) {
    console.error("❌ Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}