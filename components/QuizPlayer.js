"use client";

import { useState } from 'react';
import { 
  CheckCircle, XCircle, ChevronRight, RefreshCcw, 
  BookOpen, Loader2, Play, Calculator, Sigma, BrainCircuit 
} from 'lucide-react';
import { generateNewQuiz } from '@/app/actions/generateNewQuiz';

/**
 * Helper: Difficulty Badge Color
 */
const getDifficultyColor = (level) => {
  switch (level?.toLowerCase()) {
    case 'easy': return 'bg-green-100 text-green-700 border-green-200';
    case 'hard': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-yellow-100 text-yellow-700 border-yellow-200'; // Medium
  }
};

export default function QuizPlayer({ 
  quiz = [],          // Conceptual questions
  numericals = [],    // Numerical sets grouped by formula
  formulas = [],      // Formula cheat sheet
  summary, 
  memoryId 
}) {
  // --- STATES ---
  // View: 'menu' | 'playing' | 'loading' | 'finished'
  const [view, setView] = useState('menu');
  
  // Active Quiz Data
  const [activeQuestions, setActiveQuestions] = useState([]);
  const [activeTitle, setActiveTitle] = useState("");
  const [isConceptual, setIsConceptual] = useState(true); // Tracks if we can regenerate

  // Gameplay State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [score, setScore] = useState(0);

  // --- ACTIONS ---

  // 1. Start a specific set (Conceptual or Numerical)
  const startSession = (questions, title, isConceptualType = false) => {
    setActiveQuestions(questions);
    setActiveTitle(title);
    setIsConceptual(isConceptualType);
    
    // Reset Game State
    setCurrentIndex(0);
    setScore(0);
    setSelectedOption(null);
    setIsAnswerRevealed(false);
    setView('playing');
  };

  // 2. Handle Answer Selection
  const handleSelect = (option) => {
    if (isAnswerRevealed) return;
    
    setSelectedOption(option);
    setIsAnswerRevealed(true);

    const correct = activeQuestions[currentIndex].correctAnswer;
    if (option === correct) {
      setScore((prev) => prev + 1);
    }
  };

  // 3. Next Question
  const handleNext = () => {
    if (currentIndex + 1 < activeQuestions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerRevealed(false);
    } else {
      setView('finished');
    }
  };

  // 4. Regenerate (Only for Conceptual Quiz)
  const handleRegenerate = async () => {
    setView('loading');
    try {
      const result = await generateNewQuiz(memoryId);
      if (result.success) {
        startSession(result.questions, "Conceptual Quiz", true);
      } else {
        alert("Failed to generate new questions.");
        setView('finished');
      }
    } catch (error) {
      console.error(error);
      alert("Error connecting to AI.");
      setView('finished');
    }
  };

  // --- VIEW: MENU (Summary & Selection) ---
  if (view === 'menu') {
    return (
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 space-y-8">
        
        {/* Header Section */}
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-800 mb-4">
            <BookOpen className="text-blue-600" /> Executive Summary
          </h2>
          <div className="prose prose-blue text-gray-600 leading-relaxed whitespace-pre-wrap">
            {summary || "No summary available."}
          </div>
        </div>

        {/* Formulas Cheat Sheet (Only if formulas exist) */}
        {formulas.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-4">
              <Sigma size={20} className="text-purple-600" /> Key Formulas
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {formulas.map((f, i) => (
                <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <div className="font-mono text-blue-700 font-bold text-lg mb-1">{f.expression}</div>
                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{f.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider">Practice Modes</h3>
          
          {/* 1. Main Conceptual Quiz */}
          <button
            onClick={() => startSession(quiz, "Conceptual Quiz", true)}
            disabled={quiz.length === 0}
            className="w-full group bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl flex items-center justify-between transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/30 rounded-lg">
                <BrainCircuit size={24} className="text-white" />
              </div>
              <div className="text-left">
                <div className="font-bold text-lg">Conceptual Quiz</div>
                <div className="text-blue-100 text-sm">{quiz.length} Theory Questions</div>
              </div>
            </div>
            <Play size={24} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* 2. Numerical Sets (Dynamic List) */}
          {numericals.map((set, idx) => (
            <button
              key={idx}
              onClick={() => startSession(set.problems, `Practice: ${set.relatedFormula}`, false)}
              className="w-full group bg-white border-2 border-slate-100 hover:border-purple-200 hover:bg-purple-50 p-4 rounded-xl flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg group-hover:bg-purple-200">
                  <Calculator size={24} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-slate-700 group-hover:text-purple-900">
                    {set.relatedFormula}
                  </div>
                  <div className="text-slate-400 text-sm group-hover:text-purple-600">
                    {set.problems.length} Numerical Problems
                  </div>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-300 group-hover:text-purple-400" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- VIEW: LOADING ---
  if (view === 'loading') {
    return (
      <div className="bg-white p-16 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center animate-in fade-in">
        <Loader2 size={48} className="animate-spin text-blue-600 mb-6" />
        <h3 className="text-xl font-bold text-gray-800">Generating Fresh Questions</h3>
        <p className="text-gray-500 mt-2">Consulting the AI to create new conceptual challenges...</p>
      </div>
    );
  }

  // --- VIEW: FINISHED ---
  if (view === 'finished') {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center space-y-8 animate-in zoom-in duration-300">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Session Complete! 🎉</h2>
          <p className="text-gray-500">{activeTitle}</p>
        </div>
        
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 inline-block">
          <span className="block text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">Your Score</span>
          <span className="text-6xl font-black text-blue-600">{score}</span>
          <span className="text-xl text-slate-400 font-medium"> / {activeQuestions.length}</span>
        </div>

        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          {isConceptual ? (
            <button 
              onClick={handleRegenerate} 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <RefreshCcw size={18} /> Generate New Questions
            </button>
          ) : (
            <div className="text-xs text-center text-slate-400 italic px-4">
              (Numerical sets cannot be auto-regenerated yet. Try the conceptual quiz for fresh content!)
            </div>
          )}
          
          <button 
            onClick={() => startSession(activeQuestions, activeTitle, isConceptual)}
            className="w-full bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
          >
            Retry This Set
          </button>

          <button 
            onClick={() => setView('menu')} 
            className="text-gray-400 hover:text-gray-600 text-sm font-medium py-2"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW: PLAYING ---
  const q = activeQuestions[currentIndex];
  if (!q) return null;

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100 transition-all">
      {/* Quiz Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${getDifficultyColor(q.difficulty)}`}>
               {q.difficulty || 'Medium'}
             </span>
             <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
               Question {currentIndex + 1}/{activeQuestions.length}
             </span>
          </div>
          <h2 className="text-sm font-semibold text-blue-600">{activeTitle}</h2>
        </div>
        <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm font-bold border border-blue-100">
           Score: {score}
        </div>
      </div>

      {/* Question */}
      <h3 className="text-xl md:text-2xl font-medium text-gray-800 mb-8 leading-snug">
        {q.question}
      </h3>

      {/* Options */}
      <div className="space-y-3">
        {q.options.map((option, idx) => {
          const isSelected = selectedOption === option;
          const isCorrect = option === q.correctAnswer;
          
          let style = "border-gray-200 hover:border-blue-400 hover:bg-blue-50"; 
          if (isAnswerRevealed) {
            if (isCorrect) style = "border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500";
            else if (isSelected && !isCorrect) style = "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500";
            else style = "border-gray-100 opacity-50";
          } else if (isSelected) {
            style = "border-blue-500 bg-blue-50 ring-1 ring-blue-500";
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(option)}
              disabled={isAnswerRevealed}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex justify-between items-center ${style}`}
            >
              <span className="font-medium text-lg">{option}</span>
              {isAnswerRevealed && isCorrect && <CheckCircle className="text-green-600 shrink-0" size={20} />}
              {isAnswerRevealed && isSelected && !isCorrect && <XCircle className="text-red-600 shrink-0" size={20} />}
            </button>
          );
        })}
      </div>

      {/* Explanation & Next */}
      {isAnswerRevealed && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-slate-700 mb-6">
            <span className="font-bold text-slate-900 block mb-1">Explanation:</span>
            {q.explanation || "No explanation provided."}
          </div>
          
          <button 
            onClick={handleNext}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-md hover:translate-x-1 transition-all"
          >
            {currentIndex + 1 === activeQuestions.length ? "Finish Session" : "Next Question"} 
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}