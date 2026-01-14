import { DLFormData, Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';

/**
 * Preprocesses an image file to improve OCR accuracy.
 * Converts to grayscale, increases contrast, and applies binarization.
 */
export const preprocessImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            resolve(img.src);
            return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Binarization & Contrast logic
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Luma formula for grayscale
          const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          
          // Simple Thresholding for high contrast text
          // Threshold of 135 helps separate text from security background patterns
          const val = gray > 135 ? 255 : 0;

          data[i] = val;     // R
          data[i + 1] = val; // G
          data[i + 2] = val; // B
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Detects Jurisdiction based on state names or codes in text.
 */
export const detectJurisdiction = (text: string): Jurisdiction | null => {
    const upperText = text.toUpperCase();
    
    // Sort by length desc to match "West Virginia" before "Virginia"
    const candidates = JURISDICTIONS
        .filter(j => !j.name.includes("Old"))
        .sort((a, b) => b.name.length - a.name.length);

    for (const jur of candidates) {
        // Check for full name or explicit "STATE OF [CODE]"
        if (upperText.includes(jur.name.toUpperCase())) {
            return jur;
        }
    }
    return null;
}

/**
 * Helper to convert various date formats to MMDDYYYY (AAMVA standard)
 */
const toAAMVADate = (dateStr: string): string => {
    const clean = dateStr.replace(/[^0-9]/g, '');
    if (clean.length === 8) {
        const yearFirst = parseInt(clean.substring(0, 4));
        const yearLast = parseInt(clean.substring(4, 8));
        
        // Input: YYYYMMDD -> Output: MMDDYYYY
        if (yearFirst > 1900 && yearFirst < 2100) {
             return clean.substring(4, 6) + clean.substring(6, 8) + clean.substring(0, 4);
        }
        // Input: MMDDYYYY -> Output: MMDDYYYY
        if (yearLast > 1900 && yearLast < 2100) {
            return clean;
        }
    }
    return '';
};

/**
 * Smart Parser specifically tuned for US Driver's Licenses.
 * Handles numbered fields (Texas style: 1. Name, 2. Name, 8. Address)
 */
export const parseOCRData = (text: string): Partial<DLFormData> => {
    const updates: Partial<DLFormData> = {};
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const fullText = text.toUpperCase();

    // --- 1. NAMES (Texas Style: 1. Last, 2. First Middle) ---
    // Regex allows for "1." or just "1" followed by text
    const texasLn = fullText.match(/(?:^|\n)\s*1\.?\s*([A-Z\-\s]+)(?=\n|$)/);
    const texasFn = fullText.match(/(?:^|\n)\s*2\.?\s*([A-Z]+)(?:\s+([A-Z\s]+))?(?=\n|$)/);

    if (texasLn) {
        updates.DCS = texasLn[1].trim();
    } else {
        // Standard Fallback
        const lnMatch = fullText.match(/(?:LN|LAST|SURNAME)\s*[:.]?\s*([A-Z]+)/);
        if (lnMatch) updates.DCS = lnMatch[1];
    }

    if (texasFn) {
        updates.DAC = texasFn[1].trim();
        if (texasFn[2]) updates.DAD = texasFn[2].trim();
    } else {
        // Standard Fallback
        const fnMatch = fullText.match(/(?:FN|FIRST|GIVEN)\s*[:.]?\s*([A-Z]+)/);
        if (fnMatch) updates.DAC = fnMatch[1];
    }

    // --- 2. DATES (Specific Labels vs Sorting) ---
    const datePattern = /(\d{2}[-/. ]\d{2}[-/. ]\d{4}|\d{4}[-/. ]\d{2}[-/. ]\d{2})/g;
    
    // Explicit Label Search first
    lines.forEach(line => {
        const upper = line.toUpperCase();
        const dates = line.match(datePattern);
        if (!dates) return;
        const val = toAAMVADate(dates[0]);
        if (!val) return;

        if (upper.includes("DOB") || upper.includes("BIRTH") || upper.match(/\b3\./)) {
            updates.DBB = val;
        } else if (upper.includes("EXP") || upper.includes("EXPIRES") || upper.match(/\b4B\./)) {
            updates.DBA = val;
        } else if (upper.includes("ISS") || upper.includes("ISSUED") || upper.match(/\b4A\./)) {
            updates.DBD = val;
        }
    });

    // Fallback: Sort all dates found
    if (!updates.DBB || !updates.DBA) {
        const allDates = fullText.match(datePattern);
        if (allDates) {
             const sorted = allDates.map(d => toAAMVADate(d))
                .filter(d => d.length === 8)
                .sort((a, b) => {
                     // Sort by Year
                     return parseInt(a.slice(4)) - parseInt(b.slice(4));
                 });
             
             if (sorted.length > 0) {
                 // Earliest sensible date is DOB (check not too old, not future)
                 if (!updates.DBB) updates.DBB = sorted[0]; 
                 // Furthest future date is Exp
                 if (!updates.DBA) updates.DBA = sorted[sorted.length - 1];
                 // Middle date is usually Issue
                 if (!updates.DBD && sorted.length > 2) updates.DBD = sorted[1];
             }
        }
    }

    // --- 3. ADDRESS (Texas Style: 8. Street \n City State Zip) ---
    let addressLineIndex = -1;
    
    // Find line starting with "8."
    for (let i = 0; i < lines.length; i++) {
        if (/^8\.\s/.test(lines[i])) {
            updates.DAG = lines[i].replace(/^8\.\s*/, '').trim(); // Street
            addressLineIndex = i;
            break;
        }
    }

    // If we found "8.", look at the next line for City/State/Zip
    if (addressLineIndex !== -1 && addressLineIndex + 1 < lines.length) {
        const cityStateLine = lines[addressLineIndex + 1];
        // Regex: City Name (comma?) State Zip
        // Matches: DALLAS, TX 75217-2579
        const addressParts = cityStateLine.match(/^([A-Z\s]+)[,.]?\s+([A-Z]{2})\s+(\d{5}(?:[- ]?\d{4})?)/i);
        
        if (addressParts) {
            updates.DAI = addressParts[1].trim().replace(/,$/, ''); // City
            updates.DAJ = addressParts[2].toUpperCase(); // State
            updates.DAK = addressParts[3].replace(/[^0-9]/g, '').padEnd(9, '0').slice(0,9); // Zip (formatted)
        }
    } else {
        // Fallback: Just look for Zip
        const zipMatch = fullText.match(/\b(\d{5})[- ]?(\d{4})?\b/);
        if (zipMatch && !updates.DAK) {
            updates.DAK = zipMatch[1] + (zipMatch[2] || "0000");
        }
    }

    // --- 4. PHYSICAL STATS ---
    
    // Sex: "15. Sex: F" or "SEX F"
    if (/(?:SEX|15\.?)\s*[:.]?\s*F\b/i.test(fullText)) updates.DBC = '2';
    else if (/(?:SEX|15\.?)\s*[:.]?\s*M\b/i.test(fullText)) updates.DBC = '1';

    // Height: "16. Hgt: 5'-02""
    const hgtMatch = fullText.match(/(?:HGT|HEIGHT|16\.?)\s*[:.]?\s*(\d)[' -]?(\d{2})"/i);
    if (hgtMatch) {
        const ft = parseInt(hgtMatch[1]);
        const inch = parseInt(hgtMatch[2]);
        updates.DAU = ((ft * 12) + inch).toString().padStart(3, '0') + " in";
    }

    // Eyes: "18. Eyes: BRO"
    const eyeCodes = ["BRO", "BLU", "GRN", "HAZ", "BLK", "GRY", "MAR", "PNK", "DIC"];
    for (const code of eyeCodes) {
        if (fullText.includes(code) && (fullText.includes("EYE") || fullText.includes("18"))) {
            updates.DAY = code;
            break;
        }
    }

    // Hair: "Hai: BLK" (Often hard to read, keep generic search)
    const hairCodes = ["BAL", "BLK", "BLN", "BRO", "GRY", "RED", "SDY", "WHI"];
    for (const code of hairCodes) {
        if (fullText.includes(code) && (fullText.includes("HAI"))) {
            updates.DAZ = code;
            break;
        }
    }

    // --- 5. LICENSE NUMBER (4d. DL) ---
    const dlMatch = fullText.match(/(?:4D\.?|DL|LIC)\s*[:.]?\s*([A-Z0-9]{5,})/i);
    if (dlMatch) {
        updates.DAQ = dlMatch[1];
    }

    return updates;
};