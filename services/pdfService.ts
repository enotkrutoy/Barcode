import * as pdfjsLib from 'pdfjs-dist';

// Set worker source to CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

export const convertPdfToImages = async (file: File): Promise<File[]> => {
  const fileArrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(fileArrayBuffer).promise;
  const images: File[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // High scale for better OCR
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) throw new Error('Canvas context not available');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const blob = await new Promise<Blob | null>((resolve) => 
      canvas.toBlob(resolve, 'image/jpeg', 0.95)
    );

    if (blob) {
      images.push(new File([blob], `${file.name}-page-${i}.jpg`, { type: 'image/jpeg' }));
    }
  }

  return images;
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove Data URL prefix to get raw base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};