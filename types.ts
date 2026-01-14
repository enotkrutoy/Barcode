export interface Jurisdiction {
  name: string;
  code: string;
  iin: string;
  version: string;
  country?: string;
}

export interface DLFormData {
  // Jurisdiction Data
  DAJ: string; // State Code
  DCG: string; // Country
  IIN: string; // Issuer ID
  Version: string; // AAMVA Version

  // Mandatory Header/Metadata
  DDA: string; // Compliance Type (F=REAL ID, N=Standard)
  DEB: string; // File Creation Date (MMDDYYYY)

  // Personal Data
  DAQ: string; // License Number
  DBA: string; // Exp Date
  DCS: string; // Last Name
  DAC: string; // First Name
  DAD: string; // Middle Name
  DBB: string; // DOB
  DBD: string; // Issue Date
  DAG: string; // Street
  DAI: string; // City
  DAK: string; // Zip
  DCA: string; // Class
  DBC: string; // Sex (1=Male, 2=Female, X=Non-binary)
  DAU: string; // Height
  DAW: string; // Weight
  DAY: string; // Eye Color
  DAZ: string; // Hair Color
  
  // Restrictions / Endorsements (Must be present, "NONE" if empty)
  DCB: string; // Restrictions
  DCD: string; // Endorsements
  
  DCF: string; // Doc Discriminator
  [key: string]: string; // Index signature for dynamic access
}

export interface ValidationField {
  elementId: string;
  description: string;
  formValue: string;
  scannedValue: string;
  status: 'MATCH' | 'MISMATCH' | 'MISSING_IN_SCAN' | 'INVALID_FORMAT';
  message?: string;
}

export interface ValidationReport {
  isValidSignature: boolean; // Checks if header starts correctly
  rawString: string;
  fields: ValidationField[];
}