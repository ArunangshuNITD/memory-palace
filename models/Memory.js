import mongoose from "mongoose";

const MemorySchema = new mongoose.Schema({
  /* -------------------------------------------------- */
  /* 1. Upload Metadata                                */
  /* -------------------------------------------------- */
  title: {
    type: String,
    required: [true, "Please provide a title"],
    trim: true,
  },

  mediaType: {
    type: String,
    enum: ["pdf", "video"],
    required: true,
  },

  mediaUrl: {
    type: String,
    required: true,
  },

  /* -------------------------------------------------- */
  /* 2. Extracted Raw Text                              */
  /* -------------------------------------------------- */
  extractedText: {
    type: String,
    required: true,
    trim: true,
    default: "No readable text could be extracted from this file.",
  },

  /* -------------------------------------------------- */
  /* 3. AI Generated Summary                            */
  /* -------------------------------------------------- */
  summary: {
    type: String,
    default: "No summary available.",
  },

  /* -------------------------------------------------- */
  /* 4. AI Generated Patterns / Tags                    */
  /* -------------------------------------------------- */
  patterns: {
    type: [String],
    default: [],
  },

  /* -------------------------------------------------- */
  /* 5. AI Generated Quiz                               */
  /* -------------------------------------------------- */
  quiz: [
    {
      question: { type: String },
      options: { type: [String] },
      correctAnswer: { type: String },
      explanation: { type: String },
    },
  ],

  /* -------------------------------------------------- */
  /* 6. Learning Roadmap (Optional)                     */
  /* -------------------------------------------------- */
  roadmap: [
    {
      step: Number,
      title: String,
      description: String,
    },
  ],

  /* -------------------------------------------------- */
  /* 7. Timestamp                                      */
  /* -------------------------------------------------- */
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Memory ||
  mongoose.model("Memory", MemorySchema);
