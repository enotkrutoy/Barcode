import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, ImageInput } from "../types";
import { SYSTEM_PROMPT } from "../constants";

// Lazy initialization to prevent crash on module load if env is missing
let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY is missing in environment variables.");
    }
    // The API key must be obtained exclusively from the environment variable process.env.API_KEY.
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Concise summary of the document content." },
    document_type: { type: Type.STRING, description: "Specific type of the document (e.g., 'Utility Bill', 'Passport', 'Sales Invoice')." },
    fields: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING, description: "Normalized field name (e.g., 'total_amount')." },
          value: { type: Type.STRING, description: "Extracted value." },
          type: { type: Type.STRING, enum: ["string", "number", "date", "boolean", "currency"] },
          confidence: { type: Type.NUMBER, description: "Confidence score 0.0-1.0" }
        },
        required: ["key", "value", "confidence", "type"]
      }
    },
    tables: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          headers: { type: Type.ARRAY, items: { type: Type.STRING } },
          rows: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            } 
          }
        }
      }
    }
  },
  required: ["summary", "document_type", "fields"]
};

export const analyzeDocument = async (images: ImageInput[]): Promise<AnalysisResult> => {
  try {
    const client = getAiClient();
    
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          ...images,
          { text: SYSTEM_PROMPT }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      }
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    // Parse and Sanitize
    let jsonStr = response.text.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    const data = JSON.parse(jsonStr) as AnalysisResult;
    
    // Ensure arrays exist
    return {
      summary: data.summary || "No summary available.",
      document_type: data.document_type || "Unknown",
      fields: Array.isArray(data.fields) ? data.fields : [],
      tables: Array.isArray(data.tables) ? data.tables : []
    };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // Improve error message for UI
    if (error.message?.includes("429")) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    if (error.message?.includes("403") || error.message?.includes("API_KEY") || error.message?.includes("API key")) {
      throw new Error("Invalid or missing API Key. Please check your .env file.");
    }
    throw new Error("Failed to analyze document. " + (error.message || "Unknown error."));
  }
};