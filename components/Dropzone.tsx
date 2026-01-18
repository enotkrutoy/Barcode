import React, { useState, useCallback } from 'react';
import { UploadCloud, FileType, Image as ImageIcon, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { ProcessingStatus } from '../types';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  status: ProcessingStatus;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFileSelect, status }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (status === ProcessingStatus.ANALYZING) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndPassFile(e.dataTransfer.files[0]);
    }
  }, [status]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndPassFile(e.target.files[0]);
    }
  };

  const validateAndPassFile = (file: File) => {
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      onFileSelect(file);
    } else {
      alert('Please upload an image (JPG, PNG) or PDF file.');
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={clsx(
        "relative group border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer bg-white",
        isDragging ? "border-google-blue bg-blue-50" : "border-google-border hover:border-google-blue hover:bg-gray-50",
        status === ProcessingStatus.ANALYZING && "opacity-50 pointer-events-none"
      )}
    >
      <input
        type="file"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={handleInputChange}
        accept="image/*,application/pdf"
        disabled={status === ProcessingStatus.ANALYZING}
      />
      
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className={clsx(
          "p-4 rounded-full transition-colors",
          isDragging ? "bg-blue-100" : "bg-gray-100 group-hover:bg-blue-100"
        )}>
          {status === ProcessingStatus.ANALYZING ? (
            <Loader2 className="w-8 h-8 text-google-blue animate-spin" />
          ) : (
            <UploadCloud className={clsx("w-8 h-8", isDragging ? "text-google-blue" : "text-gray-400 group-hover:text-google-blue")} />
          )}
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-google-text">
            {status === ProcessingStatus.ANALYZING ? "Processing Document..." : "Drop your document here"}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Support for PDF (Multi-page) and Images (JPG, PNG)
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-400 font-medium uppercase tracking-wider">
          <span className="flex items-center gap-1"><FileType className="w-4 h-4" /> PDF</span>
          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
          <span className="flex items-center gap-1"><ImageIcon className="w-4 h-4" /> JPG/PNG</span>
        </div>
      </div>
    </div>
  );
};