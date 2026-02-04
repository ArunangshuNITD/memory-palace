import mongoose from "mongoose";

const MemorySchema = new mongoose.Schema({
  title: { type: String, required: true },
  mediaType: { type: String, enum: ["pdf", "video"], required: true },
  mediaUrl: { type: String, required: true },
  extractedText: { type: String, required: true },
  summary: { type: String, default: "" },
  patterns: { type: [String], default: [] },
  
  // Updated Quiz Sub-document
  quiz: [
    {
      question: { type: String, required: true },
      options: { type: [String], required: true },
      correctAnswer: { type: String, required: true }, // Will store full text
      explanation: { type: String },
    },
  ],

  roadmap: [
    { step: Number, title: String, description: String },
  ],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Memory || mongoose.model("Memory", MemorySchema);