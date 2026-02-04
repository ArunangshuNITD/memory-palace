"use client";

import { useState } from 'react';
import { CheckCircle, XCircle, ChevronRight, RefreshCcw, BookOpen, Loader2, Play } from 'lucide-react';
import { generateNewQuiz } from '@/app/actions/generateNewQuiz'; // Ensure this path matches where you created the action

export default function QuizPlayer({ initialQuestions = [], memoryId, summary }) {
  // View States: 'summary' | 'quiz' | 'loading' | 'finished'
  const [view, setView] = useState('summary'); 
  const [questions, setQuestions] = useState(initialQuestions);
  
  // Quiz Logic States
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  // 1. Handle User Selection
  const handleSelect = (option) => {
    if (showResult) return; // Prevent changing answer after selection
    setSelected(option);
    setShowResult(true);
    
    // Check if correct
    if (option === questions[current].correctAnswer) {
      setScore(score + 1);
    }
  };

  // 2. Move to Next Question or Finish
  const nextQuestion = () => {
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
      setSelected(null);
      setShowResult(false);
    } else {
      setView('finished');
    }
  };

  // 3. Generate NEW Questions (Server Action)
  const handleRegenerate = async () => {
    setView('loading');
    
    try {
      const result = await generateNewQuiz(memoryId);
      
      if (result.success) {
        setQuestions(result.questions);
        // Reset Quiz States for the new set
        setCurrent(0);
        setScore(0);
        setSelected(null);
        setShowResult(false);
        setView('quiz'); // Start the new quiz immediately
      } else {
        alert("Failed to generate new questions. Please try again.");
        setView('finished');
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong connecting to the AI.");
      setView('finished');
    }
  };

  // 4. Simple Restart (Same Questions)
  const handleRestartSame = () => {
    setCurrent(0);
    setScore(0);
    setSelected(null);
    setShowResult(false);
    setView('quiz');
  };

  // --- VIEW: SUMMARY (Start Screen) ---
  if (view === 'summary') {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 transition-all">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-800 mb-6">
          <BookOpen className="text-blue-500" /> Executive Summary
        </h2>
        
        {/* Render the summary with preserved newlines */}
        <div className="prose prose-blue text-gray-700 leading-relaxed mb-8 whitespace-pre-wrap">
          {summary || "No summary available."}
        </div>
        
        <button 
          onClick={() => setView('quiz')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01] shadow-md hover:shadow-lg"
        >
          <Play size={20} fill="currentColor" /> Start Quiz
        </button>
      </div>
    );
  }

  // --- VIEW: LOADING (Generating New Questions) ---
  if (view === 'loading') {
    return (
      <div className="bg-white p-16 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center animate-in fade-in">
        <Loader2 size={48} className="animate-spin text-purple-600 mb-6" />
        <h3 className="text-xl font-bold text-gray-800">Consulting the AI...</h3>
        <p className="text-gray-500 mt-2">Reading your text and writing 5 fresh questions.</p>
      </div>
    );
  }

  // --- VIEW: FINISHED ---
  if (view === 'finished') {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center space-y-6 animate-in zoom-in duration-300">
        <h2 className="text-3xl font-bold text-gray-800">Quiz Completed! 🎉</h2>
        
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 inline-block shadow-inner">
          <span className="block text-gray-500 text-xs uppercase font-bold tracking-wider mb-2">Final Score</span>
          <span className="text-5xl font-extrabold text-blue-600">{score} / {questions.length}</span>
        </div>

        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          {/* Button: Generate New Questions */}
          <button 
            onClick={handleRegenerate} 
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            <RefreshCcw size={18} /> Generate 5 New Questions
          </button>
          
          {/* Button: Retry Same Quiz */}
          <button 
            onClick={handleRestartSame}
            className="w-full bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
          >
            Retry These Questions
          </button>

          {/* Button: Back to Summary */}
          <button 
            onClick={() => {
               setCurrent(0); setSelected(null); setScore(0); setShowResult(false); setView('summary');
            }} 
            className="text-gray-400 hover:text-gray-600 text-sm font-medium py-2 transition-colors"
          >
            Back to Summary
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW: ACTIVE QUIZ ---
  const q = questions[current];

  // Guard clause if no questions exist
  if (!q) return <div className="p-4 text-center text-red-500">Error: No questions loaded.</div>;

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100 transition-all">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-wider">
            Question {current + 1} of {questions.length}
        </span>
        <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
            Score: {score}
        </div>
      </div>

      {/* Question Text */}
      <h3 className="text-xl md:text-2xl font-medium text-gray-800 mb-8 leading-snug">
        {q.question}
      </h3>

      {/* Options List */}
      <div className="space-y-3">
        {q.options.map((option, idx) => {
          const isSelected = selected === option;
          const isCorrect = option === q.correctAnswer;
          
          // Dynamic Styles based on state
          let style = "border-gray-200 hover:border-blue-400 hover:bg-blue-50"; 

          if (showResult) {
            if (isCorrect) style = "border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500";
            else if (isSelected && !isCorrect) style = "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500";
            else style = "border-gray-100 opacity-50";
          } else if (isSelected) {
            style = "border-blue-500 bg-blue-50 ring-1 ring-blue-500 shadow-sm";
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(option)}
              disabled={showResult}
              className={`w-full text-left p-4 md:p-5 rounded-xl border-2 transition-all duration-200 ${style}`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium text-lg">{option}</span>
                {showResult && isCorrect && <CheckCircle size={24} className="text-green-600 flex-shrink-0 ml-2" />}
                {showResult && isSelected && !isCorrect && <XCircle size={24} className="text-red-600 flex-shrink-0 ml-2" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer / Explanation (Appears after selection) */}
      {showResult && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-slate-700 mb-6">
            <span className="font-bold text-slate-900 block mb-1">Explanation:</span>
            {q.explanation || "No explanation provided for this question."}
          </div>
          
          <button 
            onClick={nextQuestion}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all hover:translate-x-1 shadow-md hover:shadow-lg"
          >
            {current + 1 === questions.length ? "Finish Quiz" : "Next Question"} <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}