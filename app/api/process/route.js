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

// 🔧 THE FIX: A Robust JSON Cleaner for AI Responses
function cleanAndParseJSON(text) {
  // 1. Remove Markdown code blocks (```json ... ```)
  let cleaned = text.replace(/```json|```/g, "").trim();

  // 2. Extract just the JSON object (from first { to last })
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  
  // If no JSON found, throw error to trigger the catch block
  if (start === -1 || end === -1) throw new Error("No JSON object found");
  
  cleaned = cleaned.substring(start, end + 1);

  try {
    // Attempt 1: Direct Parse
    return JSON.parse(cleaned);
  } catch (e) {
    console.log("⚠️ Direct JSON parse failed (likely LaTeX). Attempting to sanitize...");

    // 3. SANITIZATION: Fix common AI JSON mistakes
    // This Regex finds backslashes (\) that are NOT followed by valid JSON escape chars 
    // and turns them into double backslashes (\\). 
    // Example: "\sigma" becomes "\\sigma"
    const sanitized = cleaned.replace(/\\(?![/u"\\bfnrt])/g, '\\\\');

    try {
      return JSON.parse(sanitized);
    } catch (e2) {
      console.error("❌ Fatal JSON Parse Error. Raw Text:", text);
      throw new Error("Failed to parse AI response.");
    }
  }
}

// Normalize Quiz Data
function normalizeQuiz(quiz = []) {
  if (!Array.isArray(quiz)) return [];
  return quiz.map((q) => {
    if (!q?.question || !Array.isArray(q.options)) return null;

    const options = q.options.map((o) => String(o).trim());
    let correct = (q.correctAnswer || "").toString().trim();

    // Map "A/B/C/D" to actual option text
    if (/^[A-D]$/i.test(correct)) {
      const index = correct.toUpperCase().charCodeAt(0) - 65;
      correct = options[index] ?? options[0];
    }
    
    // Ensure correct answer matches one of the options
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

// Normalize Numerical Data
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
    const fileType = formData.get('type'); 

    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = "";

    // 3. Extract Text
    console.log("🔍 Extracting text from", fileType);
    if (fileType === 'video') {
      const { result, error } = await deepgram.listen.prerecorded.transcribeFile(buffer, {
        model: "nova-2", smart_format: true, punctuate: true,
      });
      if (error) throw new Error("Deepgram error");
      extractedText = result.results.channels[0].alternatives[0].transcript;
    } 
    else if (fileType === 'pdf') {
      const pdfData = await pdf(buffer);
      extractedText = pdfData.text;
    }

    // Truncate text to fit context window
    const truncatedText = extractedText.substring(0, 30000);

    // 4. GENERATE AI CONTENT
    console.log("🧠 Sending to Gemini...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // 🔥 PROMPT UPDATE: Explicit instructions for JSON safety
    const prompt = `
      You are an expert teacher. Analyze this text and return a STRICTLY VALID JSON object.
      
      CRITICAL INSTRUCTION FOR MATH/LATEX:
      - If you include formulas with backslashes (like \\sigma, \\frac), you MUST escape them (e.g., \\\\sigma, \\\\frac).
      - Do NOT output Markdown. Just the raw JSON string.

      Structure:
      {
        "summary": "Concise summary",
        "patterns": ["concept1", "concept2"],
        "formulas": [ { "expression": "E=mc^2", "description": "Energy-mass equivalence" } ],
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
      ${truncatedText}
    `;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();

    // 5. Parse and Normalize Data
    // We use cleanAndParseJSON here instead of the old function
    const aiData = cleanAndParseJSON(textResponse);

    console.log("✅ Parsed Formulas Count:", aiData.formulas?.length || 0);
    console.log("✅ Parsed Numericals Count:", aiData.numericals?.length || 0);

    // 6. SAVE TO DB
    const newMemory = await Memory.create({
      title: file.name,
      mediaType: fileType,
      extractedText: extractedText,
      mediaUrl: "https://example.com", 
      summary: aiData.summary || "",
      patterns: aiData.patterns || [],
      formulas: aiData.formulas || [],
      roadmap: aiData.roadmap || [],
      quiz: normalizeQuiz(aiData.quiz),
      numericals: normalizeNumericals(aiData.numericals),
    });

    console.log("💾 Saved Memory ID:", newMemory._id);
    
    return NextResponse.json({ success: true, id: newMemory._id });

  } catch (error) {
    console.error("❌ Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}