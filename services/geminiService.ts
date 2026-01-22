
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    if (!API_KEY) {
      console.warn("API_KEY not found in environment. Gemini functionality will be limited.");
    }
    this.ai = new GoogleGenAI({ apiKey: API_KEY || "" });
  }

  async getDopaAnalysis(prompt: string) {
    if (!API_KEY) return "AI System Offline: No API Key detected.";
    
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: `You are DOPA (Digital Operating Power Architecture), the AI assistant for Richard D. Fortune and the Dopa-Tech ecosystem. 
          Your tone is sophisticated, high-fidelity, and authoritative. You understand the Morphic Trade Axis, the 7-Collection Framework, and the bypass of Western financial systems.
          Key terms: The Axis, Morphic, Linear Bridge, Sovereignty-as-Infrastructure, Engine Two.
          Be concise and strategic. Avoid "generative beige" - be sharp and insightful.`,
          temperature: 0.7,
        },
      });

      return response.text;
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Critical failure in neural uplink. Attempting reconnection.";
    }
  }
}

export const dopaAI = new GeminiService();
