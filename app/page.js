"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Import router for redirection
import { FileText, Video, UploadCloud, Sparkles, Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { processMedia } from './actions/processMedia';

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Constructing your Palace...");
  
  // Initialize the router
  const router = useRouter();

  const handleUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Reset states & Start Loading
    setIsSuccess(false);
    setIsProcessing(true);
    setStatusMessage(`Extracting logic from ${type}...`);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type.toLowerCase()); // "video" or "pdf"

    try {
      // 2. Call the Server Action
      const result = await processMedia(formData);
      
      if (result.success) {
        // 3. Handle Success
        setIsSuccess(true);
        setStatusMessage("Memory Created! Redirecting...");
        
        console.log("New Memory ID:", result.id);
        
        // 4. ✅ AUTO-REDIRECT after 2 seconds
        setTimeout(() => {
            router.push(`/memory/${result.id}`);
        }, 2000);

      } else {
        // 4. Handle Backend Error
        setStatusMessage("Error: " + result.error);
        // Allow user to try again after 3 seconds
        setTimeout(() => {
            setIsProcessing(false);
            setStatusMessage("Constructing your Palace...");
        }, 3000);
      }

    } catch (err) {
      // 5. Handle Network/Code Error
      console.error(err);
      setStatusMessage("Something went wrong. Please try again.");
      setTimeout(() => setIsProcessing(false), 3000);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-50">
      
      {/* --- HERO SECTION --- */}
      <section className="w-full max-w-5xl px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-8 border border-indigo-100">
          <Sparkles size={16} />
          <span>Powered by Gemini 2.5 Flash & Deepgram</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
          Turn Content into <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
            Descriptive Intelligence.
          </span>
        </h1>
        
        <p className="max-w-2xl mx-auto text-lg text-slate-600 mb-10">
          Upload any video lecture or PDF textbook. We extract the hidden patterns, 
          generate smart quizzes, and build a permanent memory palace for your knowledge.
        </p>
      </section>

      {/* --- UPLOAD SECTION --- */}
      <section className="w-full max-w-6xl px-6 pb-24">
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* PDF CARD */}
          <div className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-xl hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <FileText size={120} className="text-indigo-600" />
            </div>
            
            <div className="relative z-10">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <FileText size={28} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Upload PDF</h2>
              <p className="mt-2 text-slate-500">
                Process research papers, textbooks, or notes. We parse the text structure 
                and extract key definitions.
              </p>
              
              <label className="mt-8 flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-100 bg-slate-50 py-6 hover:bg-indigo-50/50 transition-colors">
                <div className="flex flex-col items-center justify-center text-center">
                  <UploadCloud className="mb-2 h-8 w-8 text-indigo-400" />
                  <p className="text-sm font-medium text-slate-600">Click to browse PDF</p>
                  <p className="text-xs text-slate-400">up to 10MB</p>
                </div>
                {/* PDF INPUT */}
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf" 
                  onChange={(e) => handleUpload(e, 'PDF')} 
                />
              </label>
            </div>
          </div>

          {/* VIDEO CARD */}
          <div className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-xl hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Video size={120} className="text-emerald-600" />
            </div>
            
            <div className="relative z-10">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Video size={28} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Upload Video</h2>
              <p className="mt-2 text-slate-500">
                Transcribe lectures or meetings. We use Deepgram to convert speech to text 
                before analysis.
              </p>
              
              <label className="mt-8 flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-100 bg-slate-50 py-6 hover:bg-emerald-50/50 transition-colors">
                <div className="flex flex-col items-center justify-center text-center">
                  <UploadCloud className="mb-2 h-8 w-8 text-emerald-400" />
                  <p className="text-sm font-medium text-slate-600">Click to browse Video</p>
                  <p className="text-xs text-slate-400">MP4, MOV, AVI</p>
                </div>
                {/* VIDEO INPUT */}
                <input 
                  type="file" 
                  className="hidden" 
                  accept="video/*" 
                  onChange={(e) => handleUpload(e, 'Video')} 
                />
              </label>
            </div>
          </div>

        </div>

        {/* LOADING & SUCCESS OVERLAY */}
        {isProcessing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm transition-all duration-300">
            <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
              
              {/* Conditional Icon: Loading Spinner OR Success Check */}
              {isSuccess ? (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600 animate-in zoom-in duration-300">
                    <CheckCircle size={48} />
                </div>
              ) : (
                <Loader2 size={48} className="animate-spin text-indigo-600" />
              )}

              <div className="text-center">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  {isSuccess ? "Success!" : "Processing Content..."}
                </h3>
                <p className="text-lg text-slate-600 animate-pulse">{statusMessage}</p>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}