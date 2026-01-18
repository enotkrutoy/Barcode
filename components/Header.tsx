import React from 'react';
import { BrainCircuit, FileText } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-google-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-google-blue p-2 rounded-lg">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-google-text tracking-tight">DocuMind AI</h1>
            <p className="text-xs text-gray-500 font-medium hidden sm:block">POWERED BY GEMINI 3.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <a href="#" className="text-sm font-medium text-gray-600 hover:text-google-blue transition-colors">Documentation</a>
          <button className="bg-google-blue hover:bg-google-blueHover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm">
            API Access
          </button>
        </div>
      </div>
    </header>
  );
};