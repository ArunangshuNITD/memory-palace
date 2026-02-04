import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Memory from '@/models/Memory';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@deepgram/sdk';
import pdf from 'pdf-parse';

// Initialize AI Clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

export async function POST(req) {
  try {
    // 1. Connect to Database
    await connectDB();
    
    // 2. Handle File Upload
    const formData = await req.formData();
    const file = formData.get('file');
    const fileType = formData.get('type'); // "video" or "pdf"

    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    // Convert file to buffer for processing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let extractedText = "";

    // 3. Extract Text (Deepgram or PDF Parse)
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

    // 4. SAVE TO DB (Initial Save)
    console.log("💾 Saving raw text to MongoDB...");
    const newMemory = await Memory.create({
      title: file.name,
      mediaType: fileType,
      extractedText: extractedText, 
    });

    // 5. GENERATE AI CONTENT (Gemini)
    console.log("🧠 Sending to Gemini...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
      You are an expert teacher. Analyze this text and return a valid JSON object.
      Do not wrap in markdown.
      Structure:
      {
        "patterns": ["concept 1", "concept 2", "concept 3", "concept 4", "concept 5"],
        "quiz": [
          {
            "question": "Question text?",
            "options": ["A", "B", "C", "D"],
            "correctAnswer": "The correct option string"
          },
          {...},
          {...}
        ]
      }
      
      Text to analyze:
      ${extractedText.substring(0, 30000)} 
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textResponse = response.text();
    
    // Clean and Parse JSON
    const cleanedJson = textResponse.replace(/```json|```/g, '').trim();
    const aiData = JSON.parse(cleanedJson);

    // 6. UPDATE DB with AI Results
    newMemory.patterns = aiData.patterns;
    newMemory.quiz = aiData.quiz;
    await newMemory.save();

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