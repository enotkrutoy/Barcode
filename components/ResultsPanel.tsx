import React, { useState } from 'react';
import { AnalysisResult, ProcessingStatus } from '../types';
import { Table, List, Code, CheckCircle2, AlertCircle, Download, Copy, FileJson, FileSpreadsheet, Check } from 'lucide-react';
import clsx from 'clsx';

interface ResultsPanelProps {
  result: AnalysisResult | null;
  status: ProcessingStatus;
  error: string | null;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ result, status, error }) => {
  const [activeTab, setActiveTab] = useState<'fields' | 'tables' | 'json'>('fields');
  const [copied, setCopied] = useState(false);

  const handleCopyJSON = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documind-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    if (!result || !result.fields.length) return;
    
    const headers = ['Key', 'Value', 'Type', 'Confidence'];
    const rows = result.fields.map(f => [
      `"${f.key.replace(/"/g, '""')}"`,
      `"${String(f.value).replace(/"/g, '""')}"`,
      f.type,
      f.confidence.toFixed(2)
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documind-fields-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (status === ProcessingStatus.ANALYZING) {
    return (
      <div className="h-full bg-white rounded-xl border border-google-border p-6 flex flex-col gap-4">
        <div className="h-8 w-1/3 bg-gray-200 rounded animate-pulse mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
             <div key={i} className="loader-shimmer h-12 rounded-lg w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (status === ProcessingStatus.ERROR) {
    return (
      <div className="h-full bg-red-50 rounded-xl border border-red-100 p-8 flex flex-col items-center justify-center text-center">
        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
          <AlertCircle className="w-8 h-8 text-google-red" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">Analysis Failed</h3>
        <p className="text-sm text-gray-600 mt-2 max-w-xs">{error || "An unexpected error occurred."}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full bg-google-gray/30 rounded-xl border border-google-border border-dashed p-8 flex flex-col items-center justify-center text-center">
        <p className="text-gray-400 font-medium">Results will appear here</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-xl border border-google-border overflow-hidden shadow-sm">
      {/* Header Summary */}
      <div className="p-6 border-b border-google-border bg-gray-50/50">
        <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
                 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 uppercase tracking-wide">
                    {result.document_type}
                </span>
                <div className="text-green-600 flex items-center gap-1 text-xs font-medium px-2">
                  <CheckCircle2 className="w-4 h-4" /> Processed
                </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-1">
               <button onClick={handleDownloadCSV} title="Download Fields CSV" className="p-1.5 text-gray-500 hover:text-google-blue hover:bg-white rounded-md transition-all">
                  <FileSpreadsheet className="w-4 h-4" />
               </button>
               <button onClick={handleDownloadJSON} title="Download JSON" className="p-1.5 text-gray-500 hover:text-google-blue hover:bg-white rounded-md transition-all">
                  <FileJson className="w-4 h-4" />
               </button>
            </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed font-sans">{result.summary}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-google-border px-4 pt-2 gap-4 bg-white sticky top-0 z-10">
        <button
          onClick={() => setActiveTab('fields')}
          className={clsx(
            "flex items-center gap-2 pb-3 px-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === 'fields' ? "border-google-blue text-google-blue" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <List className="w-4 h-4" /> Fields <span className="bg-gray-100 text-gray-600 px-1.5 rounded-md text-xs">{result.fields?.length || 0}</span>
        </button>
        <button
          onClick={() => setActiveTab('tables')}
          className={clsx(
            "flex items-center gap-2 pb-3 px-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === 'tables' ? "border-google-blue text-google-blue" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <Table className="w-4 h-4" /> Tables <span className="bg-gray-100 text-gray-600 px-1.5 rounded-md text-xs">{result.tables?.length || 0}</span>
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={clsx(
            "flex items-center gap-2 pb-3 px-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === 'json' ? "border-google-blue text-google-blue" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <Code className="w-4 h-4" /> JSON
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar p-0 bg-white">
        {activeTab === 'fields' && (
          <div className="divide-y divide-gray-100">
            {result.fields?.map((field, idx) => (
              <div key={idx} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center group">
                <div className="pr-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">{field.key}</p>
                  <p className="text-sm font-medium text-gray-900 break-all">{String(field.value)}</p>
                </div>
                <div className="text-right min-w-[60px]">
                  <div className="flex items-center gap-1 justify-end">
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={clsx("h-full rounded-full", field.confidence > 0.8 ? "bg-google-green" : field.confidence > 0.5 ? "bg-google-yellow" : "bg-google-red")}
                        style={{ width: `${field.confidence * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">CONF: {Math.round(field.confidence * 100)}%</span>
                </div>
              </div>
            ))}
            {(!result.fields || result.fields.length === 0) && (
                <div className="p-8 text-center text-gray-500 text-sm">No specific fields extracted.</div>
            )}
          </div>
        )}

        {activeTab === 'tables' && (
          <div className="p-6 space-y-8">
            {result.tables?.map((table, tIdx) => (
              <div key={tIdx} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-sm font-bold text-gray-700 flex justify-between items-center">
                  <span>{table.title || `Table ${tIdx + 1}`}</span>
                  <span className="text-xs font-normal text-gray-400">{table.rows.length} rows</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white text-gray-500 font-semibold border-b border-gray-200">
                      <tr>
                        {table.headers?.map((h, i) => (
                          <th key={i} className="px-4 py-3 whitespace-nowrap bg-gray-50/50">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {table.rows?.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-blue-50/30 transition-colors">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-4 py-2.5 text-gray-800 border-r border-transparent last:border-r-0">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
             {(!result.tables || result.tables.length === 0) && (
                <div className="p-8 text-center text-gray-500 text-sm">No tables found in the document.</div>
            )}
          </div>
        )}

        {activeTab === 'json' && (
          <div className="relative group h-full">
            <button 
              onClick={handleCopyJSON}
              className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur border border-gray-200 rounded-md shadow-sm text-gray-500 hover:text-google-blue transition-all opacity-0 group-hover:opacity-100 z-10"
              title="Copy JSON"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <pre className="p-6 text-xs font-mono text-gray-700 bg-[#fafafa] h-full overflow-auto leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};