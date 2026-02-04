import connectDB from '@/lib/db';
import Memory from '@/models/Memory';
import QuizPlayer from '@/components/QuizPlayer';
import { Map, Calendar, Link as LinkIcon, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// ✅ Helper to fetch and sanitize data (Fixes the "Plain Object" error)
const getData = async (id) => {
  try {
    await connectDB();
    const memory = await Memory.findById(id).lean();
    
    if (!memory) return null;
    
    // Convert all ObjectIds and Dates to strings to make Next.js happy
    return JSON.parse(JSON.stringify(memory));
  } catch (error) {
    console.error("Error fetching memory:", error);
    return null;
  }
};

export default async function MemoryPage({ params }) {
  // Await params for Next.js 15+ compatibility
  const { id } = await params;
  const memory = await getData(id);

  if (!memory) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-300 mb-4">404</h1>
                <p className="text-gray-500">Memory not found.</p>
                <Link href="/" className="text-blue-500 hover:underline mt-4 block">Go Home</Link>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* --- 1. HEADER SECTION --- */}
      <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          
          {/* Top Row: Back Link & Type Badge */}
          <div className="flex justify-between items-center mb-3">
             <Link href="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-slate-900 transition-colors">
                <ArrowLeft size={16} /> Back to Dashboard
             </Link>
             <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs font-mono font-bold uppercase tracking-wider">
                {memory.mediaType}
             </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
            {memory.title}
          </h1>

          {/* Meta Data */}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
                <Calendar size={14}/> 
                {new Date(memory.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </span>
            <a 
                href={memory.mediaUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              <LinkIcon size={14}/> View Original Source
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">

        {/* --- 2. PATTERNS / KEYWORDS --- */}
        {memory.patterns && memory.patterns.length > 0 && (
            <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {memory.patterns.map((tag, i) => (
                    <span key={i} className="px-3 py-1 bg-white text-slate-600 rounded-full text-xs font-bold border border-slate-200 shadow-sm hover:border-blue-300 hover:text-blue-600 transition-colors cursor-default">
                        #{tag}
                    </span>
                ))}
            </div>
        )}

        {/* --- 3. STUDY HUB (Summary, Formulas, Quiz Selection) --- */}
        <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          <QuizPlayer 
             quiz={memory.quiz || []}
             numericals={memory.numericals || []} 
             formulas={memory.formulas || []}
             summary={memory.summary} 
             memoryId={memory._id} 
          />
        </section>

        {/* --- 4. LEARNING ROADMAP --- */}
        {memory.roadmap && memory.roadmap.length > 0 && (
          <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 mb-6">
              <Map className="text-emerald-500" /> Learning Roadmap
            </h2>
            
            <div className="space-y-4">
              {memory.roadmap.map((step, idx) => (
                <div 
                    key={idx} 
                    className="flex gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden transition-all hover:shadow-md hover:border-emerald-200"
                >
                  {/* Step Number Bubble */}
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-md">
                    {step.step || idx + 1}
                  </div>
                  
                  {/* Content */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg mb-1">{step.title}</h3>
                    <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                        {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        
      </div>
    </div>
  );
}