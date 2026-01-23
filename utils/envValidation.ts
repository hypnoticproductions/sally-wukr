export interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  geminiApiKey: string;
}

export function validateEnv(): EnvConfig {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const missing: string[] = [];

  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (!geminiApiKey) missing.push('VITE_GEMINI_API_KEY');

  if (missing.length > 0) {
    const errorMessage = `Missing required environment variables: ${missing.join(', ')}.\n\nPlease copy .env.example to .env and fill in the required values.`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    geminiApiKey,
  };
}

export function getEnv(): EnvConfig {
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  };
}

export function isConfigured(): boolean {
  const env = getEnv();
  return !!(env.supabaseUrl && env.supabaseAnonKey && env.geminiApiKey);
}
