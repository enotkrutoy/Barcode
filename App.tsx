import React, { useState, useRef, useEffect } from 'react';
import { JURISDICTIONS } from './constants';
import { Jurisdiction, DLFormData, ValidationReport } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, parseOCRData, detectJurisdiction } from './utils/ocr';
import { validateBarcode } from './utils/validator';
import BarcodeCanvas from './components/BarcodeCanvas';
import { ArrowLeft, CreditCard, ShieldCheck, Camera, Loader2, Sparkles, ScanBarcode, CheckCircle, AlertTriangle, XCircle, Upload, FileText, Image as ImageIcon, Search, Maximize2, X, Trash2, Star } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { BrowserPDF417Reader } from '@zxing/library';

const App: React.FC = () => {
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [generatedString, setGeneratedString] = useState<string>("");
  
  // Image Preview State
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // OCR States
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validator States
  const [isValidating, setIsValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const validatorInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Search/Filter State
  const [filterText, setFilterText] = useState("");
  
  // Initial Form State
  const [formData, setFormData] = useState<DLFormData>({
    DAJ: '', DCG: '', IIN: '', Version: '',
    DDA: 'F', // Default to Real ID Compliant
    DEB: new Date().toISOString().slice(0, 10).replace(/-/g, '') + '', // MMDDYYYY approx
    DAQ: 'D12345678',
    DBA: '08092028',
    DCS: 'Doe',
    DAC: 'John',
    DAD: 'A',
    DBB: '01151985',
    DBD: '01152023',
    DAG: '123 Main St',
    DAI: 'Anytown',
    DAK: '90210',
    DCA: 'C',
    DBC: '1',
    DAU: '070',
    DAW: '165',
    DAY: 'BRO',
    DAZ: 'BRO',
    DCB: 'NONE',
    DCD: 'NONE',
    DCF: '112233445566'
  });

  // CLEANUP: Revoke Blob URLs to prevent memory leaks when component unmounts
  useEffect(() => {
    // Set proper current date on mount for DEB
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    setFormData(prev => ({ ...prev, DEB: `${mm}${dd}${yyyy}` }));

    return () => {
      if (scanPreviewUrl) {
        URL.revokeObjectURL(scanPreviewUrl);
      }
    };
  }, [scanPreviewUrl]);

  // Helper to handle preview generation and cleanup of previous preview
  const handleFilePreview = (file: File) => {
    if (scanPreviewUrl) {
      URL.revokeObjectURL(scanPreviewUrl); // Free memory of previous image
    }
    const url = URL.createObjectURL(file);
    setScanPreviewUrl(url);
  };

  const clearPreview = (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent triggering parent clicks
    if (scanPreviewUrl) {
      URL.revokeObjectURL(scanPreviewUrl);
      setScanPreviewUrl(null);
    }
    // Also clear input values so the same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (validatorInputRef.current) validatorInputRef.current.value = '';
  };

  const handleSelectJurisdiction = (jur: Jurisdiction) => {
    setSelectedJurisdiction(jur);
    setFormData(prev => ({
      ...prev,
      DAJ: jur.code,
      DCG: jur.country || 'USA',
      IIN: jur.iin,
      Version: jur.version
    }));
    setGeneratedString("");
    setValidationReport(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setSelectedJurisdiction(null);
    setGeneratedString("");
    setValidationReport(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerate = () => {
    const rawString = generateAAMVAString(formData);
    setGeneratedString(rawString);
    setValidationReport(null); 
  };

  // --- OCR / Scanning Logic (Text) ---
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsScanning(true);
    setScanStatus("Processing...");
    const file = e.target.files[0];
    
    // Set Preview with cleanup
    handleFilePreview(file);

    try {
        setScanStatus("Enhancing Image...");
        const processedImageBase64 = await preprocessImage(file);
        
        setScanStatus("OCR Engine...");
        const worker = await createWorker('eng');
        const ret = await worker.recognize(processedImageBase64);
        
        setScanStatus("Parsing Data...");
        const rawText = ret.data.text;
        const updates = parseOCRData(rawText);
        
        // Auto-detect Jurisdiction
        setScanStatus("Detecting State...");
        const detectedJur = detectJurisdiction(rawText);
        
        await worker.terminate();

        // Update Data
        setFormData(prev => ({ ...prev, ...updates }));

        if (detectedJur) {
            // Automatically switch to the correct state form
            handleSelectJurisdiction(detectedJur);
        } else if (!selectedJurisdiction) {
            alert("Data scanned, but State could not be automatically detected. Please select the State manually.");
        }

    } catch (err) {
        console.error("OCR Error:", err);
        alert("Failed to scan image. Please try again with a clearer photo.");
    } finally {
        setIsScanning(false);
        setScanStatus("");
    }
  };

  // --- Validator Logic (Barcode) ---
  const triggerValidatorInput = () => {
    validatorInputRef.current?.click();
  };

  const handleValidateScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsValidating(true);
    const file = e.target.files[0];
    
    // Set Preview with cleanup
    handleFilePreview(file);

    const reader = new FileReader();
    reader.onload = async (evt) => {
        const imageSrc = evt.target?.result as string;
        const codeReader = new BrowserPDF417Reader();

        try {
            const result = await codeReader.decodeFromImageUrl(imageSrc);
            const rawText = result.getText();
            const report = validateBarcode(rawText, formData);
            setValidationReport(report);
            setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

        } catch (err) {
            console.error(err);
            alert("Could not decode PDF417. Ensure image is clear.");
            setValidationReport(null);
        } finally {
            setIsValidating(false);
        }
    };

    reader.readAsDataURL(file);
  };

  // --- Action Buttons Handlers ---
  const handleValidateCurrent = () => {
    if (!generatedString) return;
    const report = validateBarcode(generatedString, formData);
    setValidationReport(report);
    setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // GENERATE FILENAME HELPER
  // Format: [DAQ]_[YYYYMMDD_HHMMSS].[ext]
  const getExportFilename = (extension: string) => {
      const docNum = formData.DAQ ? formData.DAQ.replace(/[^a-zA-Z0-9]/g, '') : 'UNKNOWN';
      const now = new Date();
      // YYYYMMDD_HHMMSS format
      const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
      return `${docNum}_${timestamp}.${extension}`;
  };

  const handleDownloadImage = () => {
    const canvas = document.getElementById('generated-pdf417') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = getExportFilename('png');
      link.href = url;
      // Append to body to ensure click works on some mobile browsers
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadText = () => {
    if (!generatedString) return;
    const blob = new Blob([generatedString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = getExportFilename('txt');
    link.href = url;
    // Append to body to ensure click works on some mobile browsers
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredJurisdictions = JURISDICTIONS.filter(j => 
    j.name.toLowerCase().includes(filterText.toLowerCase()) || 
    j.code.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-sky-500 selection:text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20 backdrop-blur-md bg-opacity-90">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col items-center relative">
            {selectedJurisdiction && (
                <button 
                    onClick={handleBack}
                    className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center text-sky-400 hover:text-sky-300 font-medium transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </button>
            )}
            <h1 className="text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
                <CreditCard className="w-7 h-7 text-sky-500" />
                AAMVA <span className="text-sky-500">PRO</span>
            </h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest mt-1 font-medium">
                {selectedJurisdiction 
                    ? `Generating for: ${selectedJurisdiction.name}` 
                    : 'Universal ID Generator & Validator'}
            </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 mt-6">
        
        {/* --- GLOBAL SCANNER (VISIBLE ON MAIN PAGE) --- */}
        {!selectedJurisdiction && (
            <div className="mb-10 animate-fade-in">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl relative overflow-hidden flex flex-col items-center">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="relative z-10 text-center space-y-6 max-w-lg w-full">
                        <div className="inline-flex p-3 rounded-full bg-slate-800 border border-slate-700 shadow-inner mb-2">
                             <Sparkles className="w-6 h-6 text-sky-400 animate-pulse" />
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-white">
                            Start by Scanning an ID
                        </h2>
                        <p className="text-slate-400 text-lg">
                            Upload a front image of any US/Canada driver's license. We'll detect the state and auto-fill the data.
                        </p>
                        
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={triggerFileInput}
                                disabled={isScanning}
                                className="group relative bg-sky-600 hover:bg-sky-500 text-white text-lg font-bold py-4 px-8 rounded-xl flex items-center gap-3 transition-all transform hover:scale-105 shadow-lg shadow-sky-900/20"
                            >
                                {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-6 h-6" />}
                                {isScanning ? scanStatus : "Scan ID Image"}
                                <div className="absolute inset-0 rounded-xl ring-2 ring-white/20 group-hover:ring-white/40 transition-all"></div>
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleImageScan} accept="image/*" className="hidden" />
                        </div>

                         {/* Thumbnail Preview on Home Screen */}
                         {scanPreviewUrl && (
                             <div className="mt-8 flex flex-col items-center animate-fade-in-up">
                                 <div className="relative group w-48 h-32 rounded-lg overflow-hidden border-2 border-slate-600 shadow-lg bg-black/50">
                                     <img 
                                        src={scanPreviewUrl} 
                                        alt="Scan Preview" 
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                     />
                                     <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity backdrop-blur-sm">
                                         <button 
                                            onClick={() => setIsPreviewOpen(true)}
                                            className="p-2 bg-sky-600 rounded-full text-white hover:bg-sky-500 transition-colors shadow-lg"
                                            title="Expand"
                                         >
                                            <Maximize2 size={18} />
                                         </button>
                                         <button 
                                            onClick={clearPreview}
                                            className="p-2 bg-red-600 rounded-full text-white hover:bg-red-500 transition-colors shadow-lg"
                                            title="Clear"
                                         >
                                            <Trash2 size={18} />
                                         </button>
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    Image Loaded
                                 </div>
                             </div>
                         )}
                         
                        <p className="text-xs text-slate-500 mt-2">Supported Formats: JPG, PNG • 100% Client-Side Processing</p>
                    </div>
                </div>

                {/* State Grid */}
                <div className="mt-12">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-sky-500" />
                            Or Select Jurisdiction Manually
                        </h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                type="text" 
                                placeholder="Search state..." 
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none w-full md:w-64 placeholder-slate-600"
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {filteredJurisdictions.map((jur) => (
                            <button
                                key={`${jur.name}-${jur.version}`}
                                onClick={() => handleSelectJurisdiction(jur)}
                                className={`
                                    text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 border
                                    ${jur.name.includes("Old") 
                                        ? 'text-slate-500 bg-slate-900/50 border-slate-800 hover:bg-slate-800 hover:border-slate-600 italic' 
                                        : 'text-slate-300 bg-slate-900 border-slate-800 hover:border-sky-500/50 hover:bg-slate-800 hover:text-sky-400 hover:shadow-lg hover:shadow-sky-900/10'
                                    }
                                `}
                            >
                                {jur.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* --- FORM & GENERATOR (VISIBLE WHEN STATE SELECTED) --- */}
        {selectedJurisdiction && (
            <div className="space-y-6 animate-fade-in">
                
                {/* Secondary Tools */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-between items-center bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                                 <Sparkles className="w-4 h-4 text-sky-400" />
                                 Re-Scan Data
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Update fields from a new image</p>
                        </div>
                        
                        {/* Mini Thumbnail in Toolbar */}
                        {scanPreviewUrl && (
                            <div className="mr-4 relative group w-12 h-12 rounded-lg border border-slate-700 overflow-hidden cursor-pointer bg-black/50" onClick={() => setIsPreviewOpen(true)}>
                                <img src={scanPreviewUrl} alt="Thumb" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Maximize2 size={14} className="text-white"/>
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={triggerFileInput}
                            disabled={isScanning || isValidating}
                            className="bg-slate-800 hover:bg-slate-700 text-sky-400 text-sm font-bold py-2 px-4 rounded-lg border border-slate-700 transition-colors flex items-center gap-2"
                        >
                            {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                            Scan
                        </button>
                    </div>

                    <div className="flex justify-between items-center bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                                 <ScanBarcode className="w-4 h-4 text-indigo-400" />
                                 Validate Barcode
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Check existing PDF417 image</p>
                        </div>
                        <button 
                            onClick={triggerValidatorInput}
                            disabled={isScanning || isValidating}
                            className="bg-slate-800 hover:bg-slate-700 text-indigo-400 text-sm font-bold py-2 px-4 rounded-lg border border-slate-700 transition-colors flex items-center gap-2"
                        >
                            {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Upload
                        </button>
                        <input type="file" ref={validatorInputRef} onChange={handleValidateScan} accept="image/*" className="hidden" />
                    </div>
                </div>

                {/* Validation Report */}
                {validationReport && (
                    <div ref={reportRef} className="bg-slate-900 rounded-xl shadow-lg border border-indigo-900/50 overflow-hidden animate-fade-in-up">
                        <div className="bg-indigo-950/30 px-6 py-4 border-b border-indigo-900/50 flex justify-between items-center">
                            <h3 className="font-bold text-indigo-300 flex items-center gap-2">
                                <ScanBarcode className="w-5 h-5" />
                                Validation Report
                            </h3>
                            <div className={`flex items-center gap-2 text-xs font-mono px-2 py-1 rounded border ${validationReport.isValidSignature ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                                Header: {validationReport.isValidSignature ? "VALID ANSI" : "INVALID"}
                            </div>
                        </div>
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-300">
                                <thead className="bg-slate-950 text-slate-500 text-xs uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-3">Element</th>
                                        <th className="px-6 py-3">Form Data</th>
                                        <th className="px-6 py-3">Scanned Data</th>
                                        <th className="px-6 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {validationReport.fields.map((field) => (
                                        <tr key={field.elementId} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-slate-300">
                                                {field.elementId} <span className="text-slate-600 font-normal ml-1 text-xs">({field.description})</span>
                                            </td>
                                            <td className="px-6 py-3 text-slate-500 font-mono text-xs truncate max-w-[150px]">{field.formValue}</td>
                                            <td className="px-6 py-3 text-slate-500 font-mono text-xs truncate max-w-[150px]">{field.scannedValue}</td>
                                            <td className="px-6 py-3 text-right">
                                                {field.status === 'MATCH' && <span className="text-green-500 font-bold text-xs flex items-center justify-end gap-1"><CheckCircle className="w-3 h-3"/> MATCH</span>}
                                                {field.status === 'MISMATCH' && <span className="text-red-500 font-bold text-xs flex items-center justify-end gap-1"><XCircle className="w-3 h-3"/> DIFF</span>}
                                                {field.status === 'INVALID_FORMAT' && <span className="text-amber-500 font-bold text-xs flex items-center justify-end gap-1"><AlertTriangle className="w-3 h-3"/> FMT</span>}
                                                {field.status === 'MISSING_IN_SCAN' && <span className="text-slate-600 font-bold text-xs">MISSING</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="bg-slate-900 rounded-xl shadow-md border border-slate-800 p-6">
                    {/* Read Only Data */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-1 bg-sky-500 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jurisdiction (Fixed)</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">State Code</label>
                                <input type="text" readOnly value={formData.DAJ} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-500 font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Country</label>
                                <input type="text" readOnly value={formData.DCG} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-500 font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">IIN (Issuer)</label>
                                <input type="text" readOnly value={formData.IIN} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-500 font-mono" />
                            </div>
                        </div>
                    </div>

                    {/* Editable Data */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-1 bg-sky-500 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Driver Information</h3>
                        </div>

                         {/* Compliance Toggle */}
                         <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${formData.DDA === 'F' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-slate-800 text-slate-500'}`}>
                                    <Star className={`w-5 h-5 ${formData.DDA === 'F' ? 'fill-yellow-500' : ''}`} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">REAL ID Compliance</h4>
                                    <p className="text-xs text-slate-500">Gold Star standard for federal use</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFormData(prev => ({...prev, DDA: 'F'}))}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${formData.DDA === 'F' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    COMPLIANT
                                </button>
                                <button
                                    onClick={() => setFormData(prev => ({...prev, DDA: 'N'}))}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${formData.DDA === 'N' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    STANDARD
                                </button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">License # (DAQ)</label>
                                <input name="DAQ" value={formData.DAQ} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Expiration (DBA)</label>
                                <input name="DBA" value={formData.DBA} onChange={handleChange} placeholder="MMDDYYYY" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all" />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-5 mb-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Last Name</label>
                                <input name="DCS" value={formData.DCS} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">First Name</label>
                                <input name="DAC" value={formData.DAC} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Middle</label>
                                <input name="DAD" value={formData.DAD} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">DOB (DBB)</label>
                                <input name="DBB" value={formData.DBB} onChange={handleChange} placeholder="MMDDYYYY" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Issue Date (DBD)</label>
                                <input name="DBD" value={formData.DBD} onChange={handleChange} placeholder="MMDDYYYY" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none" />
                            </div>
                        </div>

                        <div className="mb-5">
                            <label className="block text-xs font-bold text-slate-400 mb-2">Street Address</label>
                            <input name="DAG" value={formData.DAG} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none" />
                        </div>

                        <div className="grid grid-cols-2 gap-5 mb-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">City</label>
                                <input name="DAI" value={formData.DAI} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Zip Code</label>
                                <input name="DAK" value={formData.DAK} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-400 mb-2">Class</label>
                                <input name="DCA" value={formData.DCA} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500" />
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-400 mb-2">Sex</label>
                                <select name="DBC" value={formData.DBC} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500">
                                    <option value="1">Male</option>
                                    <option value="2">Female</option>
                                    <option value="X">Non-binary (X)</option>
                                </select>
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-400 mb-2">Height</label>
                                <input name="DAU" value={formData.DAU} onChange={handleChange} placeholder="070" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500" />
                            </div>
                             <div className="lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-400 mb-2">Weight</label>
                                <input name="DAW" value={formData.DAW} onChange={handleChange} placeholder="165" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500" />
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-400 mb-2">Eyes</label>
                                <input name="DAY" value={formData.DAY} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500" />
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-400 mb-2">Hair</label>
                                <input name="DAZ" value={formData.DAZ} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500" />
                            </div>
                        </div>

                         <div className="grid grid-cols-2 gap-5 mb-5">
                             <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Restrictions (DCB)</label>
                                <input name="DCB" value={formData.DCB} onChange={handleChange} placeholder="NONE" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Endorsements (DCD)</label>
                                <input name="DCD" value={formData.DCD} onChange={handleChange} placeholder="NONE" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none" />
                            </div>
                        </div>

                         <div className="mb-2">
                            <label className="block text-xs font-bold text-slate-400 mb-2">Doc Discriminator</label>
                            <input name="DCF" value={formData.DCF} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-sky-500 focus:border-sky-500" />
                        </div>
                    </div>

                    <button 
                        onClick={handleGenerate}
                        className="w-full bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-sky-900/40 transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2 text-lg"
                    >
                        Generate AAMVA Barcode
                    </button>
                </div>

                {/* Result Area */}
                {generatedString && (
                    <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 p-6 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                             <h3 className="text-xl font-bold text-white text-center">Generated PDF417</h3>
                             <button
                                onClick={handleValidateCurrent}
                                className="text-xs flex items-center gap-1 bg-indigo-900/30 text-indigo-400 px-3 py-2 rounded-lg hover:bg-indigo-900/50 border border-indigo-900 transition-colors font-medium"
                            >
                                <ShieldCheck className="w-4 h-4" /> Verify
                            </button>
                        </div>
                        
                        <BarcodeCanvas data={generatedString} />

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-3 justify-center mt-8 border-t border-slate-800 pt-6">
                            <button
                                onClick={handleDownloadImage}
                                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-lg border border-slate-700 text-sm font-medium transition-colors"
                            >
                                <ImageIcon className="w-4 h-4" /> Export PNG
                            </button>
                             <button
                                onClick={handleDownloadText}
                                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-lg border border-slate-700 text-sm font-medium transition-colors"
                            >
                                <FileText className="w-4 h-4" /> Export TXT
                            </button>
                        </div>
                        
                        <div className="mt-6">
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Raw Data String</label>
                            <textarea 
                                readOnly 
                                value={generatedString} 
                                rows={4} 
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-500 resize-none focus:outline-none"
                            />
                        </div>
                    </div>
                )}
            </div>
        )}
      </main>

      {/* Image Preview Lightbox Modal */}
      {isPreviewOpen && scanPreviewUrl && (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setIsPreviewOpen(false)}
        >
            <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center">
                <img 
                    src={scanPreviewUrl} 
                    alt="Full Preview" 
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-slate-700"
                    onClick={(e) => e.stopPropagation()} 
                />
                <button 
                    onClick={() => setIsPreviewOpen(false)}
                    className="absolute -top-12 right-0 md:-right-12 text-slate-400 hover:text-white transition-colors bg-slate-800/50 rounded-full p-2"
                >
                    <X className="w-8 h-8" />
                </button>
                <div className="mt-4 text-slate-400 text-sm flex gap-4">
                    <button onClick={clearPreview} className="flex items-center gap-2 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" /> Clear Image
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;