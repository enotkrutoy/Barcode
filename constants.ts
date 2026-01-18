import { SampleDocument } from "./types";

export const SYSTEM_PROMPT = `
You are DocuMind AI, an advanced document analysis engine. 
Your task is to analyze the provided document images (which may be multi-page) and extract structured data.

1.  **Analyze**: Look at all pages provided. Identify the document type (e.g., Invoice, Receipt, ID Card, Contract, Form).
2.  **Summarize**: Provide a brief 1-2 sentence summary of the document's content.
3.  **Extract Fields**: Identify key-value pairs. For each field, estimate your confidence level (0.0 to 1.0) based on legibility and clarity.
4.  **Extract Tables**: Identify any tabular data. Extract headers and rows accurately.

Return strictly valid JSON. Do not include markdown code blocks.
`;

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: 'invoice',
    name: 'Tech Corp Invoice',
    url: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf',
    thumbnail: 'https://cdn-icons-png.flaticon.com/512/235/235359.png' 
  },
  {
    id: 'receipt',
    name: 'Coffee Shop Receipt',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/ReceiptSwiss.jpg',
    thumbnail: 'https://cdn-icons-png.flaticon.com/512/2922/2922830.png'
  }
];