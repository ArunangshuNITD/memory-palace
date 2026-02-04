import mongoose from "mongoose";

// Sub-document for individual Quiz/Problem Items
const QuizItemSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswer: { type: String, required: true },
  explanation: { type: String },
  difficulty: { 
    type: String, 
    enum: ["easy", "medium", "hard"], 
    required: true 
  }
}, { _id: false });

// Sub-document for Formulas
const FormulaSchema = new mongoose.Schema({
  expression: { type: String, required: true }, // e.g., "E = mc^2"
  description: { type: String, required: true } // e.g., "Mass-energy equivalence"
}, { _id: false });

// Sub-document for Numerical Problems (grouped by formula)
const NumericalSetSchema = new mongoose.Schema({
  relatedFormula: { type: String, required: true },
  problems: [QuizItemSchema] // Reusing QuizItemSchema as the structure is identical
}, { _id: false });

const MemorySchema = new mongoose.Schema({
  title: { type: String, required: true },
  mediaType: { type: String, enum: ["pdf", "video"], required: true },
  mediaUrl: { type: String, required: true },
  extractedText: { type: String, required: true },
  summary: { type: String, default: "" },
  patterns: { type: [String], default: [] },
  
  // --- Updated Sections ---

  // 1. Formulas Section
  formulas: { 
    type: [FormulaSchema], 
    default: [] 
  },

  // 2. Quiz Section (General Concepts: 2 Easy, 2 Medium, 1 Hard)
  quiz: { 
    type: [QuizItemSchema], 
    default: [] 
  },

  // 3. Numericals Section (Grouped by Formula: 1 Easy, 4 Medium, 1 Hard)
  numericals: { 
    type: [NumericalSetSchema], 
    default: [] 
  },

  roadmap: [
    { step: Number, title: String, description: String },
  ],
  
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Memory || mongoose.model("Memory", MemorySchema);