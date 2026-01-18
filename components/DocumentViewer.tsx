import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import clsx from 'clsx';

interface DocumentViewerProps {
  imageUrl: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ imageUrl, currentPage, totalPages, onPageChange }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoom = (delta: number) => {
    setScale(prev => Math.min(Math.max(0.5, prev + delta), 2.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `document-page-${currentPage + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="relative h-full flex flex-col bg-google-gray/50 rounded-xl overflow-hidden border border-google-border group">
      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur shadow-md rounded-full px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button onClick={() => handleZoom(-0.25)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600" title="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => handleZoom(0.25)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600" title="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-gray-300 mx-1"></div>
        <button onClick={handleRotate} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600" title="Rotate">
          <RotateCw className="w-4 h-4" />
        </button>
         <div className="w-px h-4 bg-gray-300 mx-1"></div>
        <button onClick={handleDownload} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600" title="Download Image">
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Main View */}
      <div className="flex-1 overflow-auto custom-scrollbar flex items-center justify-center p-8 bg-dot-pattern">
        <div 
          className="relative transition-all duration-200 ease-out shadow-lg"
          style={{ 
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center center'
          }}
        >
          <img 
            src={imageUrl} 
            alt={`Page ${currentPage}`} 
            className="max-w-full h-auto rounded-sm object-contain"
            style={{ maxHeight: '70vh' }}
          />
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-google-border p-3 flex items-center justify-between">
            <button 
              onClick={() => onPageChange(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-gray-600">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button 
              onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
        </div>
      )}
    </div>
  );
};