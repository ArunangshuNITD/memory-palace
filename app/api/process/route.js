import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Memory from '@/models/Memory';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@deepgram/sdk';
import { getDocumentProxy, extractText } from 'unpdf';

// ✅ FIX 1: Max Duration for Mobile Uploads
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// ✅ UPDATED CASCADE
const MODEL_CASCADE = [
  "gemma-3-12b-it",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemma-3-1b-it"
];

/* ---------------- HELPERS ---------------- */

async function generateWithCascade(prompt) {
  let lastError = null;

  for (const modelName of MODEL_CASCADE) {
    try {
      console.log(`🤖 Attempting generation with model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      if (response) return response;
      
    } catch (error) {
      console.warn(`⚠️ Model ${modelName} failed/skipped:`, error.message);
      lastError = error;
    }
  }
  
  throw new Error(`All AI models failed. Last error: ${lastError?.message}`);
}

function cleanAndParseJSON(text) {
  let cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error("No JSON object found");
  cleaned = cleaned.substring(start, end + 1);

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const sanitized = cleaned.replace(/\\(?![/u"\\bfnrt])/g, '\\\\');
    try {
      return JSON.parse(sanitized);
    } catch (e2) {
      console.error("❌ Fatal JSON Parse Error:", text);
      throw new Error("Failed to parse AI response.");
    }
  }
}

function normalizeQuiz(quiz = []) {
  if (!Array.isArray(quiz)) return [];
  return quiz.map((q) => {
    if (!q?.question || !Array.isArray(q.options)) return null;
    const options = q.options.map((o) => String(o).trim());
    let correct = (q.correctAnswer || "").toString().trim();
    if (/^[A-D]$/i.test(correct)) {
      const index = correct.toUpperCase().charCodeAt(0) - 65;
      correct = options[index] ?? options[0];
    }
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

function normalizeNumericals(numericals = []) {
    if (!Array.isArray(numericals)) return [];
    return numericals.map(set => {
        if (!set.relatedFormula || !Array.isArray(set.problems)) return null;
        return {
            relatedFormula: set.relatedFormula,
            problems: normalizeQuiz(set.problems)
        };
    }).filter(Boolean);
}

/* ---------------- MAIN HANDLER ---------------- */

export async function POST(req) {
  try {
    await connectDB();
    
    const body = await req.json();
    const { fileUrl, mediaType } = body;

    if (!fileUrl) return NextResponse.json({ error: "No file URL provided" }, { status: 400 });

    let extractedText = "";
    const type = mediaType ? mediaType.toLowerCase() : "unknown";

    console.log(`🔍 Processing [${type}] from URL:`, fileUrl);

    // Extraction Logic
    if (type === 'video') {
      try {
        const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
          { url: fileUrl },
          { model: "nova-2", smart_format: true, punctuate: true }
        );
        if (error) throw new Error("Deepgram error: " + error.message);
        extractedText = result?.results?.channels[0]?.alternatives[0]?.transcript || "";
      } catch (err) {
        console.error("Deepgram Transcription Failed:", err);
        throw new Error("Failed to transcribe video audio.");
      }
    } 
    else if (type === 'pdf') {
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error("Failed to fetch PDF from storage");
        
        // ✅ FIX 2: File Size Check (10MB Limit)
        const contentLength = res.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
             throw new Error("File is too large (Max 10MB). Please compress it.");
        }

        const arrayBuffer = await res.arrayBuffer();
        const pdfProxy = await getDocumentProxy(new Uint8Array(arrayBuffer));
        
        // Limit to 10 pages to avoid timeouts on mobile scans
        const maxPages = Math.min(pdfProxy.numPages, 10);
        const { text } = await extractText(pdfProxy, { mergePages: true }); // extractText handles logic usually, but we keep it simple
        
        extractedText = text || "";
      } catch (err) {
        console.error("PDF Parse Failed:", err);
        throw new Error(`PDF Error: ${err.message}`);
      }
    }

    // Validation
    console.log("📝 Extracted Text Length:", extractedText.length);
    
    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json({ 
        error: "Could not extract enough text. If this is a PDF, ensure it has selectable text." 
      }, { status: 422 });
    }

    const truncatedText = extractedText.substring(0, 30000);

    console.log("🧠 Sending to Gemini (Cascade Mode)...");
    
    // ✅ FIX 3: Prompt updated for 5 numericals
    const prompt = `
      You are an expert teacher. Analyze this text and return a STRICTLY VALID JSON object.
      
      CRITICAL INSTRUCTIONS:
      1. **FORMULAS:** Prefer Unicode (e.g., "Density (kg/m³)") over complex LaTeX. Escape backslashes if using LaTeX.
      2. **NUMERICALS (VERY IMPORTANT):** - Identify key formulas from the text.
         - For EACH formula identified, you MUST generate **AT LEAST 5** distinct numerical practice problems.
         - Vary the difficulty of these numericals.
      
      Do NOT output Markdown. Just the raw JSON string.

      Structure:
      {
        "summary": "Concise summary",
        "patterns": ["concept1", "concept2"],
        "formulas": [ { "expression": "Density (kg/m³)", "description": "Formula for density" } ],
        "quiz": [
          { "question": "...", "options": ["A","B","C","D"], "correctAnswer": "A", "difficulty": "medium", "explanation": "..." }
        ],
        "numericals": [
          { 
            "relatedFormula": "F = m*a", 
            "problems": [ 
               { "question": "Problem 1...", "options": ["A","B","C","D"], "correctAnswer": "A", "explanation": "..." },
               { "question": "Problem 2...", "options": ["A","B","C","D"], "correctAnswer": "B", "explanation": "..." },
               { "question": "Problem 3...", "options": ["A","B","C","D"], "correctAnswer": "C", "explanation": "..." },
               { "question": "Problem 4...", "options": ["A","B","C","D"], "correctAnswer": "D", "explanation": "..." },
               { "question": "Problem 5...", "options": ["A","B","C","D"], "correctAnswer": "A", "explanation": "..." }
            ] 
          }
        ],
        "roadmap": [ { "step": 1, "title": "...", "description": "..." } ],
        "diagram": "graph TD; A[Start] --> B[End];"
      }
      
      Text to analyze:
      ${truncatedText}
    `;

    const textResponse = await generateWithCascade(prompt);
    
    const aiData = cleanAndParseJSON(textResponse);

    console.log("💾 Saving to Database...");
    
    const newMemory = await Memory.create({
      title: "New Memory",
      mediaType: type,
      mediaUrl: fileUrl,
      extractedText: extractedText,
      summary: aiData.summary || "No summary generated",
      patterns: aiData.patterns || [],
      formulas: aiData.formulas || [],
      roadmap: aiData.roadmap || [],
      quiz: normalizeQuiz(aiData.quiz),
      numericals: normalizeNumericals(aiData.numericals),
      diagram: aiData.diagram || ""
    });

    console.log("✅ Success! ID:", newMemory._id);
    return NextResponse.json({ success: true, id: newMemory._id });

  } catch (error) {
    console.error("❌ Processing Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}