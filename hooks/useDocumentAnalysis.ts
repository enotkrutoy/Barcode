import { useState, useEffect, useCallback } from 'react';
import { ProcessingStatus, AnalysisResult, ImageInput } from '../types';
import { convertPdfToImages, fileToBase64 } from '../services/pdfService';
import { analyzeDocument } from '../services/geminiService';

export const useDocumentAnalysis = () => {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Cleanup URLs on unmount or change
  useEffect(() => {
    return () => {
      imageUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imageUrls]);

  const reset = useCallback(() => {
    setStatus(ProcessingStatus.IDLE);
    setResult(null);
    setError(null);
    setImageUrls([]);
    setCurrentIdx(0);
  }, []);

  const processFile = useCallback(async (file: File) => {
    try {
      reset();
      setStatus(ProcessingStatus.ANALYZING);

      // 1. PDF/Image Conversion
      let images: File[] = [];
      try {
        if (file.type === 'application/pdf') {
          images = await convertPdfToImages(file);
        } else {
          images = [file];
        }
      } catch (e) {
        throw new Error("Failed to process file. Ensure it is a valid PDF or Image.");
      }

      if (images.length === 0) {
        throw new Error("No images could be extracted from the document.");
      }

      // 2. Setup Viewer
      const newUrls = images.map(img => URL.createObjectURL(img));
      setImageUrls(newUrls);

      // 3. Prepare AI Payload
      const imageInputs: ImageInput[] = await Promise.all(
        images.map(async (img) => ({
          inlineData: {
            data: await fileToBase64(img),
            mimeType: 'image/jpeg'
          }
        }))
      );

      // 4. Gemini API Call
      const analysisData = await analyzeDocument(imageInputs);
      setResult(analysisData);
      setStatus(ProcessingStatus.SUCCESS);

    } catch (err: any) {
      console.error("Analysis Error:", err);
      setError(err.message || "An unexpected error occurred during analysis.");
      setStatus(ProcessingStatus.ERROR);
    }
  }, [reset]);

  const loadSample = useCallback(async (url: string) => {
    if (status === ProcessingStatus.ANALYZING) return;
    
    try {
      setStatus(ProcessingStatus.ANALYZING);
      
      // Proxy strategies to bypass CORS
      const strategies = [
        (u: string) => u,
        (u: string) => `https://wsrv.nl/?url=${encodeURIComponent(u)}&output=jpg`,
        (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
      ];

      let file: File | null = null;
      let lastError;

      for (const strat of strategies) {
        try {
          const fetchUrl = strat(url);
          const res = await fetch(fetchUrl);
          if (!res.ok) throw new Error('Network response not ok');
          
          const blob = await res.blob();
          if (blob.type.includes("html") || blob.type.includes("xml")) throw new Error("Invalid content type");

          file = new File([blob], "sample.jpg", { type: blob.type.includes('pdf') ? 'application/pdf' : blob.type });
          break; // Success
        } catch (e) {
          lastError = e;
          continue;
        }
      }

      if (!file) throw lastError || new Error("Could not load sample");
      
      await processFile(file);

    } catch (e: any) {
      setError("Failed to load sample document. Please try uploading a file instead.");
      setStatus(ProcessingStatus.ERROR);
    }
  }, [status, processFile]);

  return {
    status,
    result,
    error,
    imageUrls,
    currentIdx,
    setCurrentIdx,
    processFile,
    loadSample,
    reset
  };
};