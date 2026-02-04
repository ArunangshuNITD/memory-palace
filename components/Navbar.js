import Link from 'next/link';
import { BrainCircuit, Layers } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo Section */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white transition-transform group-hover:scale-110 shadow-lg shadow-indigo-200">
            <BrainCircuit size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Memory<span className="text-indigo-600">Palace</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <Link href="/dashboard" className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
            <Layers size={18} />
            My Vault
          </Link>
          <Link href="/about" className="hover:text-indigo-600 transition-colors">
            Methodology
          </Link>
          <Link href="/login" className="rounded-full bg-slate-900 px-5 py-2 text-white hover:bg-slate-800 transition-all shadow-md hover:shadow-lg">
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  );
}