import React, { useEffect, useRef } from 'react';
import bwipjs from 'bwip-js';

interface BarcodeCanvasProps {
  data: string;
}

const BarcodeCanvas: React.FC<BarcodeCanvasProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && data) {
      try {
        bwipjs.toCanvas(canvasRef.current, {
          bcid: 'pdf417',       // Barcode type
          text: data,           // Text to encode
          scale: 3,             // 3x scaling factor
          height: 10,           // Bar height, in millimeters
          includetext: false,   // Show human-readable text
          textxalign: 'center', // Always good to set this
        });
      } catch (e) {
        console.error('Barcode generation error:', e);
      }
    }
  }, [data]);

  return (
    <div className="flex justify-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Background must be white for scanners to read the barcode contrast correctly */}
      <canvas id="generated-pdf417" ref={canvasRef} className="max-w-full" />
    </div>
  );
};

export default BarcodeCanvas;