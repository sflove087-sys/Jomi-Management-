
import { GoogleGenAI } from "@google/genai";
import { LandRecord } from "../types";

// Initializing the Gemini API client with the environment variable directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getFinancialSummary = async (records: LandRecord[]) => {
  const model = 'gemini-3-flash-preview';
  
  const recordsJson = JSON.stringify(records, null, 2);
  const prompt = `
    Analyze these land contract and collection records and provide a concise summary in Bengali.
    Focus on:
    1. Total Security Amount invested in land.
    2. Total collected profit/rent (collections) across all records.
    3. ROI (Return on Investment) insights.
    4. Strategic advice for managing these land contracts and collections.
    
    Data: ${recordsJson}
    
    Format the response in Markdown with clear headings. Use Bengali digits for numbers where possible.
    Note: 'amount' is the security/investment, 'collections' is the profit history.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    // Accessing .text property directly as per Gemini API best practices.
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "দুঃখিত, এই মুহূর্তে এনালাইসিস সামারি তৈরি করা সম্ভব হচ্ছে না।";
  }
};
