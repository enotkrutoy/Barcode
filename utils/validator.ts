import { DLFormData, ValidationField, ValidationReport } from '../types';

// Map AAMVA Element IDs to readable descriptions and Form Keys
const ELEMENT_MAP: Record<string, { desc: string, formKey: keyof DLFormData, regex?: RegExp }> = {
  'DAQ': { desc: 'License Number', formKey: 'DAQ', regex: /^[A-Z0-9]+$/i },
  'DBA': { desc: 'Expiration Date', formKey: 'DBA', regex: /^\d{8}$/ }, // MMDDYYYY
  'DCS': { desc: 'Last Name', formKey: 'DCS', regex: /^[A-Z\s-]+$/i },
  'DAC': { desc: 'First Name', formKey: 'DAC', regex: /^[A-Z\s-]+$/i },
  'DAD': { desc: 'Middle Name', formKey: 'DAD' },
  'DBB': { desc: 'Date of Birth', formKey: 'DBB', regex: /^\d{8}$/ },
  'DBD': { desc: 'Issue Date', formKey: 'DBD', regex: /^\d{8}$/ },
  'DEB': { desc: 'File Creation Date', formKey: 'DEB', regex: /^\d{8}$/ },
  'DDA': { desc: 'Compliance Type', formKey: 'DDA', regex: /^[F|N]$/ }, // F = Fully Compliant (Real ID), N = Non-Compliant
  'DAG': { desc: 'Address Street', formKey: 'DAG' },
  'DAI': { desc: 'City', formKey: 'DAI' },
  'DAJ': { desc: 'State Code', formKey: 'DAJ', regex: /^[A-Z]{2}$/ },
  'DAK': { desc: 'Zip Code', formKey: 'DAK', regex: /^[0-9-]{5,11}$/ },
  'DCA': { desc: 'Class', formKey: 'DCA' },
  'DBC': { desc: 'Sex', formKey: 'DBC', regex: /^[12X]$/ }, // Added X for AAMVA 2020
  'DAU': { desc: 'Height', formKey: 'DAU' },
  'DAW': { desc: 'Weight', formKey: 'DAW' },
  'DAY': { desc: 'Eye Color', formKey: 'DAY', regex: /^[A-Z]{3}$/ },
  'DAZ': { desc: 'Hair Color', formKey: 'DAZ', regex: /^[A-Z]{3}$/ },
  'DCB': { desc: 'Restrictions', formKey: 'DCB' },
  'DCD': { desc: 'Endorsements', formKey: 'DCD' },
  'DCF': { desc: 'Doc Discriminator', formKey: 'DCF' },
  'DCG': { desc: 'Country', formKey: 'DCG', regex: /^[A-Z]{3}$/ }
};

/**
 * Parses a raw AAMVA string (PDF417 content) into a key-value map.
 * Assumes format: @...DL...DAQ12345...
 */
const parseAAMVARaw = (raw: string): Record<string, string> => {
  const result: Record<string, string> = {};
  
  // 1. Basic Header Check
  if (!raw.startsWith('@')) return result;

  // 2. Find the Subfile Block
  // Typically starts with "DL" inside the data. 
  // A simplified approach is to split by Line Feed (\n) which separates elements.
  // Note: Some scanners convert \n to actual newlines, others keep control chars.
  // We sanitize specific non-printable chars for splitting.
  
  const cleanRaw = raw.replace(/\r/g, '\n'); 
  const lines = cleanRaw.split('\n');

  lines.forEach(line => {
    line = line.trim();
    
    // Fix: The first line of a subfile block typically contains the Subfile Type (e.g. "DL")
    // concatenated immediately with the first Element ID (e.g. "DDA").
    // Example: "DLDDAF" -> We need to strip "DL" to get "DDAF".
    // We check for common subfile types: DL (Driver License), ID (ID Card), EN (Enhanced).
    if (/^(DL|ID|EN)[A-Z]{3}/.test(line)) {
      line = line.substring(2);
    }

    if (line.length < 4) return;

    // AAMVA Elements are 3 uppercase letters followed by data
    // e.g., DAQ12345678
    const match = line.match(/^([A-Z]{3})(.*)$/);
    if (match) {
      const key = match[1];
      const val = match[2].trim();
      result[key] = val;
    }
  });

  return result;
};

/**
 * Validates the scanned data against the current Form Data and AAMVA Standards.
 */
export const validateBarcode = (rawString: string, currentFormData: DLFormData): ValidationReport => {
  const scannedData = parseAAMVARaw(rawString);
  const fields: ValidationField[] = [];
  
  // Check signature
  const isValidSignature = rawString.startsWith('@') && rawString.includes('ANSI');

  Object.entries(ELEMENT_MAP).forEach(([elId, config]) => {
    const scannedVal = scannedData[elId];
    const formVal = currentFormData[config.formKey as string];

    if (!scannedVal) {
      // Field exists in our form/map but wasn't found in the barcode
      // This is okay for optional fields, but we mark it.
      fields.push({
        elementId: elId,
        description: config.desc,
        formValue: formVal || '(empty)',
        scannedValue: 'Not Found',
        status: 'MISSING_IN_SCAN'
      });
      return;
    }

    let status: ValidationField['status'] = 'MATCH';
    let msg = '';

    // 1. Format Validation (AAMVA 2020 Standard)
    if (config.regex && !config.regex.test(scannedVal)) {
      status = 'INVALID_FORMAT';
      msg = `Format mismatch for ${config.desc}. Expected pattern.`;
    }

    // 2. Comparison Validation
    // Normalize comparison (upper case, remove spaces for robust check)
    const normScanned = scannedVal.toUpperCase().replace(/\s+/g, ' ').trim();
    const normForm = (formVal || '').toUpperCase().replace(/\s+/g, ' ').trim();

    // Specific handling for Height (DAU) which might include " in" or not
    if (elId === 'DAU') {
        const hScanned = normScanned.replace(/\D/g, ''); // Extract digits
        const hForm = normForm.replace(/\D/g, '');
        if (hScanned !== hForm) {
            status = 'MISMATCH';
            msg = `Values differ: Form(${hForm}) vs Scan(${hScanned})`;
        }
    } 
    // General handling
    else if (normScanned !== normForm) {
       // Allow mismatched status to override invalid format if it's a data integrity issue
       status = 'MISMATCH';
       msg = `Data mismatch.`;
    }

    fields.push({
      elementId: elId,
      description: config.desc,
      formValue: formVal,
      scannedValue: scannedVal,
      status: status,
      message: msg
    });
  });

  return {
    isValidSignature,
    rawString,
    fields
  };
};