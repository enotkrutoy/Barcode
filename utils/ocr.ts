import { DLFormData, Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';

/**
 * Preprocesses an image file to improve OCR accuracy.
 * Converts to grayscale and applies binarization (high contrast black/white).
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

        // Binarization logic (Grayscale + Threshold)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const val = gray > 140 ? 255 : 0;

          data[i] = val;     // R
          data[i + 1] = val; // G
          data[i + 2] = val; // B
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Tries to detect which Jurisdiction (State) the ID belongs to based on OCR text.
 */
export const detectJurisdiction = (text: string): Jurisdiction | null => {
    const upperText = text.toUpperCase();
    
    // Sort jurisdictions by name length desc to match "New York" before "New" (if that existed)
    // CRITICAL FIX: We must sort by length descending. Otherwise "West Virginia" might match "Virginia" first.
    const candidates = JURISDICTIONS
        .filter(j => !j.name.includes("Old"))
        .sort((a, b) => b.name.length - a.name.length);

    for (const jur of candidates) {
        // Check for full State Name (e.g. "CALIFORNIA")
        if (upperText.includes(jur.name.toUpperCase())) {
            return jur;
        }
    }
    
    return null;
}

/**
 * Smart Parser specifically tuned for US Driver's Licenses.
 */
export const parseOCRData = (text: string): Partial<DLFormData> => {
    const updates: Partial<DLFormData> = {};
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const fullText = text.toUpperCase();

    const toAAMVADate = (dateStr: string) => {
      const clean = dateStr.replace(/[^0-9]/g, '');
      if (clean.length === 8) {
        const yearPrefix = parseInt(clean.substring(0, 4));
        // Simple heuristic: year should be reasonable
        if (yearPrefix > 1900 && yearPrefix < 2100) {
             // YYYYMMDD -> MMDDYYYY (AAMVA format is typically MMDDYYYY for DBA/DBB)
             return clean.substring(4, 6) + clean.substring(6, 8) + clean.substring(0, 4);
        }
        return clean; 
      }
      return '';
    };

    // 1. Dates
    // Regex allows MM-DD-YYYY or YYYY-MM-DD, separators can be -, /, ., or space
    const datePattern = /(\d{2}[-/. ]\d{2}[-/. ]\d{4}|\d{4}[-/. ]\d{2}[-/. ]\d{2})/g;

    lines.forEach(line => {
        const upper = line.toUpperCase();
        const datesInLine = line.match(datePattern);

        if (datesInLine) {
            const dateVal = toAAMVADate(datesInLine[0]);
            if (upper.includes("DOB") || upper.includes("BIRTH")) {
                updates.DBB = dateVal;
            } else if (upper.includes("EXP") || upper.includes("EXPIRES")) {
                updates.DBA = dateVal;
            } else if (upper.includes("ISS") || upper.includes("ISSUED")) {
                updates.DBD = dateVal;
            }
        }
    });

    if (!updates.DBB || !updates.DBA) {
        const allDates = fullText.match(datePattern);
        if (allDates) {
             const sorted = allDates.map(d => toAAMVADate(d)).filter(d => d.length === 8).sort((a, b) => {
                 // Sort by year extracted from MMDDYYYY (last 4 digits)
                 const ya = parseInt(a.slice(4));
                 const yb = parseInt(b.slice(4));
                 return ya - yb;
             });
             
             if (sorted.length > 0) {
                 if (!updates.DBB) updates.DBB = sorted[0]; // Earliest date usually DOB
                 if (!updates.DBA) updates.DBA = sorted[sorted.length - 1]; // Latest date usually Exp
             }
        }
    }

    // 2. Sex
    if (/\b(SEX|S)\s*[:.]?\s*F\b/.test(fullText)) updates.DBC = '2';
    else if (/\b(SEX|S)\s*[:.]?\s*M\b/.test(fullText)) updates.DBC = '1';

    // 3. Height
    const hgtMatch = fullText.match(/(?:HGT|HEIGHT)[\s:.]*(\d)[' -]?(\d{2})/);
    if (hgtMatch) {
        const ft = parseInt(hgtMatch[1]);
        const inch = parseInt(hgtMatch[2]);
        updates.DAU = ((ft * 12) + inch).toString().padStart(3, '0');
    }

    // 4. Weight
    const wgtMatch = fullText.match(/(?:WGT|WEIGHT)[\s:.]*(\d{2,3})/);
    if (wgtMatch) {
        updates.DAW = wgtMatch[1];
    }

    // 5. Eyes
    const eyeCodes = ["BRO", "BLU", "GRN", "HAZ", "BLK", "GRY", "MAR", "PNK", "DIC"];
    for (const code of eyeCodes) {
        if (fullText.includes(`EYES ${code}`) || fullText.includes(`EYE ${code}`) || lines.some(l => l === code)) {
            updates.DAY = code;
            break;
        }
    }

    // 6. Hair
    const hairCodes = ["BAL", "BLK", "BLN", "BRO", "GRY", "RED", "SDY", "WHI"];
    for (const code of hairCodes) {
        if (fullText.includes(`HAIR ${code}`) || fullText.includes(`HAI ${code}`)) {
            updates.DAZ = code;
            break;
        }
    }
    
    // 7. Names
    const lnMatch = fullText.match(/(?:LN|LAST|SURNAME)\s*[:.]?\s*([A-Z]+)/);
    if (lnMatch) updates.DCS = lnMatch[1];
    
    const fnMatch = fullText.match(/(?:FN|FIRST|GIVEN)\s*[:.]?\s*([A-Z]+)/);
    if (fnMatch) updates.DAC = fnMatch[1];

    // 8. Zip
    const zipMatch = fullText.match(/\b(\d{5})[- ]?(\d{4})?\b/);
    if (zipMatch) {
        updates.DAK = zipMatch[1] + (zipMatch[2] || "0000");
    }

    return updates;
};