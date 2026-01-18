export enum ProcessingStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ExtractedField {
  key: string;
  value: string | number | null;
  type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  confidence: number; // 0 to 1
}

export interface ExtractedTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface AnalysisResult {
  summary: string;
  document_type: string;
  fields: ExtractedField[];
  tables: ExtractedTable[];
}

export interface SampleDocument {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
}

export interface ImageInput {
  inlineData: {
    data: string; // Base64
    mimeType: string;
  }
}