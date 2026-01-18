import React, { useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { DocumentViewer } from './components/DocumentViewer';
import { ResultsPanel } from './components/ResultsPanel';
import { useDocumentAnalysis } from './hooks/useDocumentAnalysis';
import { ProcessingStatus } from './types';
import { SAMPLE_DOCUMENTS } from './constants';
import { ExternalLink, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const {
    status,
    result,
    error,
    imageUrls,
    currentIdx,
    setCurrentIdx,
    processFile,
    loadSample,
    reset
  } = useDocumentAnalysis();
  
  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to results on success
  useEffect(() => {
    if (status === ProcessingStatus.SUCCESS && resultsRef.current) {
        setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
  }, [status]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-64px)]">
        
        {/* Left Column: Input & Viewer */}
        <div className="lg:col-span-7 flex flex-col gap-6 h-full min-h-0">
          
          {/* Upload Area - Show when no images */}
          {imageUrls.length === 0 ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              <Dropzone onFileSelect={processFile} status={status} />
              
              <div className="space-y-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center sm:text-left">Try a Sample Document</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SAMPLE_DOCUMENTS.map((doc) => (
                    <button 
                      key={doc.id}
                      onClick={() => loadSample(doc.url)}
                      disabled={status === ProcessingStatus.ANALYZING}
                      className="flex items-center gap-4 p-4 bg-white border border-google-border rounded-xl hover:border-google-blue hover:shadow-md transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                        <img src={doc.thumbnail} className="w-8 h-8 object-contain opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-google-blue transition-colors">{doc.name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          Load Sample <ExternalLink className="w-3 h-3" />
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Document Viewer - Show when images exist */
            <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-google-blue"></span>
                    Document Viewer
                  </h2>
                  <button 
                    onClick={reset}
                    className="text-xs font-medium flex items-center gap-1.5 text-google-blue hover:text-google-blueHover bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-all"
                  >
                    <RefreshCw className="w-3 h-3" /> Analyze New File
                  </button>
               </div>
               <div className="flex-1 min-h-[400px] border border-google-border rounded-xl overflow-hidden shadow-sm bg-gray-100">
                 <DocumentViewer 
                    imageUrl={imageUrls[currentIdx]} 
                    currentPage={currentIdx}
                    totalPages={imageUrls.length}
                    onPageChange={setCurrentIdx}
                 />
               </div>
            </div>
          )}
        </div>

        {/* Right Column: Results Panel */}
        <div ref={resultsRef} className="lg:col-span-5 h-full min-h-[500px] lg:min-h-0">
          <ResultsPanel result={result} status={status} error={error} />
        </div>

      </main>
    </div>
  );
};

export default App;