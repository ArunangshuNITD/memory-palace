"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Video,
  UploadCloud,
  Sparkles,
  Loader2,
  CheckCircle,
} from "lucide-react";

// 1. Import UploadThing Helper
import { generateReactHelpers } from "@uploadthing/react";

// Initialize hook
const { useUploadThing } = generateReactHelpers();

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Constructing your Palace...");
  
  const router = useRouter();

  // 2. Setup UploadThing Hook
  const { startUpload } = useUploadThing("mediaUploader", {
    onUploadError: (error) => {
        console.error(error);
        alert("Upload failed: " + error.message);
        setIsProcessing(false);
    }
  });

  /* ---------------- UPLOAD HANDLER ---------------- */
  const handleUpload = async (e, mediaType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setIsSuccess(false);
    
    // Step 1: Cloud Upload
    setStatusMessage("Uploading to secure cloud storage...");

    try {
      // A. Perform UploadThing Upload
      const uploadRes = await startUpload([file]);
      
      if (!uploadRes || !uploadRes[0]) {
          throw new Error("Cloud upload failed");
      }

      const fileUrl = uploadRes[0].url;
      console.log("✅ File uploaded to:", fileUrl);

      // Step 2: Process AI
      setStatusMessage(
        mediaType === "video" 
          ? "Transcribing audio & analyzing visuals..." 
          : "Extracting text & patterns from PDF..."
      );

      // B. Send URL to our API
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            fileUrl: fileUrl, 
            mediaType: mediaType.toLowerCase() // "pdf" or "video"
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Processing failed");
      }

      // ✅ SUCCESS
      setStatusMessage("Memory created! Redirecting...");
      setIsSuccess(true);

      setTimeout(() => {
        router.push(`/memory/${result.id}`);
      }, 1200);

    } catch (err) {
      console.error("Pipeline error:", err);
      alert(err.message || "Something went wrong");
      setIsProcessing(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-50">

      {/* --- HERO SECTION --- */}
      <section className="w-full max-w-5xl px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-8 border border-indigo-100">
          <Sparkles size={16} />
          <span>Powered by Gemini & Deepgram</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
          Turn Content into <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
            Descriptive Intelligence.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-slate-600 mb-10">
          Upload any video lecture or PDF textbook. We extract hidden patterns,
          generate smart quizzes, and build a permanent memory palace.
        </p>
      </section>

      {/* --- UPLOAD SECTION --- */}
      <section className="w-full max-w-6xl px-6 pb-24">
        <div className="grid md:grid-cols-2 gap-8">

          {/* PDF CARD */}
          <div className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <FileText size={28} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Upload PDF</h2>

            <label className="mt-8 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-indigo-100 bg-slate-50 py-6 hover:bg-indigo-50/50 transition-colors">
              <UploadCloud className="mb-2 h-8 w-8 text-indigo-400" />
              <p className="text-sm font-medium text-slate-600">
                Click to browse PDF
              </p>
              <p className="text-xs text-slate-400">up to 16MB</p>

              <input
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={(e) => handleUpload(e, "pdf")}
                disabled={isProcessing}
              />
            </label>
          </div>

          {/* VIDEO CARD */}
          <div className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Video size={28} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Upload Video</h2>

            <label className="mt-8 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-emerald-100 bg-slate-50 py-6 hover:bg-emerald-50/50 transition-colors">
              <UploadCloud className="mb-2 h-8 w-8 text-emerald-400" />
              <p className="text-sm font-medium text-slate-600">
                Click to browse Video
              </p>
              <p className="text-xs text-slate-400">MP4, MOV, AVI (up to 64MB)</p>

              <input
                type="file"
                className="hidden"
                accept="video/*"
                onChange={(e) => handleUpload(e, "video")}
                disabled={isProcessing}
              />
            </label>
          </div>
        </div>

        {/* LOADING & SUCCESS OVERLAY */}
        {isProcessing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm transition-all duration-300">
            <div className="flex flex-col items-center gap-6">
              {isSuccess ? (
                <div className="scale-110 transition-transform duration-300">
                  <CheckCircle size={64} className="text-green-500" />
                </div>
              ) : (
                <Loader2 size={64} className="animate-spin text-indigo-600" />
              )}

              <p className="text-lg font-medium text-slate-700 animate-pulse">
                {statusMessage}
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}