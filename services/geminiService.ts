const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export class GeminiService {
  private proxyUrl: string;

  constructor() {
    if (!SUPABASE_URL) {
      console.warn("VITE_SUPABASE_URL not found. Gemini functionality will be limited.");
    }
    this.proxyUrl = `${SUPABASE_URL}/functions/v1/gemini-proxy`;
  }

  async getDopaAnalysis(prompt: string) {
    if (!SUPABASE_URL) return "AI System Offline: No configuration detected.";

    try {
      const systemPrompt = `You are DOPA (Digital Operating Power Architecture), the AI assistant for Richard D. Fortune and the Dopa-Tech ecosystem.
Your tone is sophisticated, high-fidelity, and authoritative. You understand the Morphic Trade Axis, the 7-Collection Framework, and the bypass of Western financial systems.
Key terms: The Axis, Morphic, Linear Bridge, Sovereignty-as-Infrastructure, Engine Two.
Be concise and strategic. Avoid "generative beige" - be sharp and insightful.

User query: ${prompt}`;

      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: systemPrompt,
          model: 'gemini-3-flash-preview',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Proxy error:", errorData);
        return "Critical failure in neural uplink. Attempting reconnection.";
      }

      const data = await response.json();
      return data.text || "No response generated.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Critical failure in neural uplink. Attempting reconnection.";
    }
  }
}

export const dopaAI = new GeminiService();
