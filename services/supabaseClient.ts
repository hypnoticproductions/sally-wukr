import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Session {
  id: string;
  domain: string;
  started_at: string;
  ended_at?: string;
  voice_profile: string;
  status: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: string;
  created_at: string;
}

export interface Brief {
  id: string;
  session_id: string;
  client_name: string;
  brief_content: string;
  sent_to: string;
  sent_at?: string;
  created_at: string;
}

export class SupabaseService {
  async createSession(domain: string, voiceProfile: string): Promise<string> {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        domain,
        voice_profile: voiceProfile,
        status: 'active',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async endSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;
  }

  async addMessage(sessionId: string, role: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .insert({
        session_id: sessionId,
        role,
        content,
      });

    if (error) throw error;
  }

  async getSessionMessages(sessionId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createBrief(sessionId: string, clientName: string, briefContent: string, sentTo: string): Promise<string> {
    const { data, error } = await supabase
      .from('briefs')
      .insert({
        session_id: sessionId,
        client_name: clientName,
        brief_content: briefContent,
        sent_to: sentTo,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async markBriefSent(briefId: string): Promise<void> {
    const { error } = await supabase
      .from('briefs')
      .update({
        sent_at: new Date().toISOString(),
      })
      .eq('id', briefId);

    if (error) throw error;
  }
}

export const supabaseService = new SupabaseService();
