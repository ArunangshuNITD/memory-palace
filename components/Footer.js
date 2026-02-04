import { Github, Twitter } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        
        {/* Brand */}
        <div className="text-center md:text-left">
          <h3 className="text-lg font-bold text-slate-900">Memory Palace</h3>
          <p className="mt-2 text-sm text-slate-500">
            Constructing neural maps from your digital content.
          </p>
        </div>

        {/* Links */}
        <div className="flex gap-8 text-sm text-slate-500">
          <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
          <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
          <a href="#" className="hover:text-indigo-600 transition-colors">API</a>
        </div>

        {/* Socials */}
        <div className="flex gap-4">
          <a href="#" className="text-slate-400 hover:text-slate-900 transition-colors">
            <Github size={20} />
          </a>
          <a href="#" className="text-slate-400 hover:text-slate-900 transition-colors">
            <Twitter size={20} />
          </a>
        </div>
      </div>
    </footer>
  );
}