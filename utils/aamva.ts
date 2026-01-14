import { DLFormData } from '../types';

/**
 * Generates the raw AAMVA compliant string for PDF417 generation.
 * Follows the specific Header, Subfile Designator, and Data structure.
 * Compliant with AAMVA DL/ID Card Design Standard (2020).
 */
export const generateAAMVAString = (data: DLFormData): string => {
  const complianceInd = "@";
  const dataElementSep = "\n"; // LF
  const recordSep = "\x1e";    // RS
  const segmentTerm = "\r";    // CR
  const fileType = "ANSI ";
  
  const JurVersion = "00";
  const Entries = "01"; // 1 subfile (DL)

  // 1. Build Subfile Data
  let sub = "";
  // Mandatory Subfile Header inside the data block
  sub += "DL"; 
  
  // Data Elements (Order matters for some parsers, but mostly standard fields)
  // Per AAMVA 2020 Annex D
  
  // Mandatory Header/Metadata in Subfile
  sub += `DDA${data.DDA}\n`; // Compliance Type (F/N)
  sub += `DEB${data.DEB}\n`; // File Creation Date
  
  // Personal Data
  sub += `DAQ${data.DAQ}\n`; // License Num
  sub += `DCS${data.DCS}\n`; // Last Name
  sub += `DDE\n`;            // Truncation indicator (optional)
  sub += `DAC${data.DAC}\n`; // First Name
  sub += `DDF\n`;            // Truncation
  sub += `DAD${data.DAD}\n`; // Middle Name
  sub += `DDG\n`;            // Truncation
  sub += `DCA${data.DCA}\n`; // Class
  
  // Restrictions & Endorsements are mandatory fields. If empty, use "NONE"
  const restrictions = data.DCB && data.DCB.trim() !== "" ? data.DCB : "NONE";
  const endorsements = data.DCD && data.DCD.trim() !== "" ? data.DCD : "NONE";
  
  sub += `DCB${restrictions}\n`; // Restrictions
  sub += `DCD${endorsements}\n`; // Endorsements
  
  sub += `DBA${data.DBA}\n`; // Expiration
  sub += `DBB${data.DBB}\n`; // DOB
  sub += `DBC${data.DBC}\n`; // Sex
  sub += `DAY${data.DAY}\n`; // Eye Color
  sub += `DAZ${data.DAZ}\n`; // Hair Color
  
  // Height formatting (ensure " in" or " cm" is present or strictly digits based on Jur logic, defaulting to append ' in')
  const heightVal = data.DAU.endsWith(' in') || data.DAU.endsWith(' cm') ? data.DAU : `${data.DAU} in`;
  sub += `DAU${heightVal}\n`; 
  
  sub += `DAW${data.DAW}\n`; // Weight
  sub += `DAG${data.DAG}\n`; // Street
  sub += `DAI${data.DAI}\n`; // City
  sub += `DAJ${data.DAJ}\n`; // State
  sub += `DAK${data.DAK}\n`; // Zip
  sub += `DCF${data.DCF}\n`; // Doc Discriminator
  sub += `DCG${data.DCG}\n`; // Country
  sub += `DBD${data.DBD}\n`; // Issue Date
  
  // The subfile length includes the final CR, which is added after the subfile string in the full message
  // but logically belongs to the segment structure.
  
  // 2. Header Calculation
  // Standard AAMVA Header size with 1 subfile designator is typically 31 bytes if offsets are standard strings.
  // Header Breakdown:
  // @(1) + LF(1) + RS(1) + CR(1) + "ANSI "(5) + IIN(6) + Ver(2) + JurVer(2) + Entries(2) = 21 bytes
  // Subfile Designator: Type(2) + Offset(4) + Length(4) = 10 bytes
  // Total Offset to data = 21 + 10 = 31 bytes.
  
  const subfileOffsetVal = 21 + 10; 
  // Length includes the 'sub' string plus the final segment terminator CR
  const subfileLengthVal = sub.length + 1; 
  
  const offsetStr = subfileOffsetVal.toString().padStart(4, '0');
  const lenStr = subfileLengthVal.toString().padStart(4, '0');

  // 3. Assemble Full String
  let fullString = "";
  fullString += complianceInd;
  fullString += dataElementSep;
  fullString += recordSep;
  fullString += segmentTerm;
  fullString += fileType;
  fullString += data.IIN;
  fullString += data.Version;
  fullString += JurVersion;
  fullString += Entries;
  
  // Subfile Designator
  fullString += "DL";
  fullString += offsetStr;
  fullString += lenStr;
  
  // Data Body
  fullString += sub;
  fullString += segmentTerm; // Final CR

  return fullString;
};