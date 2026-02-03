import { supabase } from './supabaseClient';
import { Client, PaymentStatus, Consultation } from '../types';

export class ClientService {
  async createClient(data: {
    name: string;
    email: string;
    company: string;
    industry?: string;
    pain_points?: string;
    desired_outcome?: string;
  }): Promise<Client | null> {
    try {
      const { data: existingClient } = await supabase
        .from('clients')
        .select('*')
        .eq('email', data.email)
        .maybeSingle();

      if (existingClient) {
        const { data: updatedClient } = await supabase
          .from('clients')
          .update({
            name: data.name,
            company: data.company,
            industry: data.industry,
            pain_points: data.pain_points,
            desired_outcome: data.desired_outcome,
            returning_client: true,
          })
          .eq('id', existingClient.id)
          .select()
          .single();

        return updatedClient;
      }

      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          name: data.name,
          email: data.email,
          company: data.company,
          industry: data.industry,
          pain_points: data.pain_points,
          desired_outcome: data.desired_outcome,
          payment_status: 'free',
          client_value_score: 0,
          returning_client: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating client:', error);
        return null;
      }

      return newClient;
    } catch (error) {
      console.error('Client service error:', error);
      return null;
    }
  }

  async updateClientScore(clientId: string, score: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ client_value_score: score })
        .eq('id', clientId);

      return !error;
    } catch (error) {
      console.error('Error updating client score:', error);
      return false;
    }
  }

  async getClientById(clientId: string): Promise<Client | null> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching client:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Client service error:', error);
      return null;
    }
  }

  async getClientByEmail(email: string): Promise<Client | null> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('Error fetching client:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Client service error:', error);
      return null;
    }
  }

  async checkPaymentStatus(clientId: string): Promise<PaymentStatus> {
    const client = await this.getClientById(clientId);

    if (!client) return 'free';

    if (client.payment_status === 'paid' && client.profile_expires_at) {
      const expiresAt = new Date(client.profile_expires_at);
      const now = new Date();

      if (expiresAt < now) {
        await supabase
          .from('clients')
          .update({ payment_status: 'expired' })
          .eq('id', clientId);

        return 'expired';
      }
    }

    return client.payment_status as PaymentStatus;
  }

  async linkSessionToClient(sessionId: string, clientId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ client_id: clientId })
        .eq('id', sessionId);

      return !error;
    } catch (error) {
      console.error('Error linking session to client:', error);
      return false;
    }
  }

  async linkBriefToClient(briefId: string, clientId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('briefs')
        .update({ client_id: clientId })
        .eq('id', briefId);

      return !error;
    } catch (error) {
      console.error('Error linking brief to client:', error);
      return false;
    }
  }

  async getDaysUntilExpiration(clientId: string): Promise<number | null> {
    const client = await this.getClientById(clientId);

    if (!client || !client.profile_expires_at) return null;

    const expiresAt = new Date(client.profile_expires_at);
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  async getAllClients(): Promise<Client[]> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all clients:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Client service error:', error);
      return [];
    }
  }

  async getRevenueStats(): Promise<{
    totalRevenue: number;
    paidClients: number;
    freeClients: number;
    expiredClients: number;
  }> {
    try {
      const { data: clients } = await supabase
        .from('clients')
        .select('payment_status, total_paid');

      if (!clients) {
        return { totalRevenue: 0, paidClients: 0, freeClients: 0, expiredClients: 0 };
      }

      const stats = clients.reduce(
        (acc, client) => {
          acc.totalRevenue += Number(client.total_paid || 0);
          if (client.payment_status === 'paid') acc.paidClients++;
          if (client.payment_status === 'free') acc.freeClients++;
          if (client.payment_status === 'expired') acc.expiredClients++;
          return acc;
        },
        { totalRevenue: 0, paidClients: 0, freeClients: 0, expiredClients: 0 }
      );

      return stats;
    } catch (error) {
      console.error('Error fetching revenue stats:', error);
      return { totalRevenue: 0, paidClients: 0, freeClients: 0, expiredClients: 0 };
    }
  }

  async getConsultationsByClient(clientId: string): Promise<Consultation[]> {
    try {
      const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .eq('client_id', clientId)
        .order('event_start_time', { ascending: false });

      if (error) {
        console.error('Error fetching consultations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Client service error:', error);
      return [];
    }
  }

  async hasActiveConsultation(clientId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('consultations')
        .select('id')
        .eq('client_id', clientId)
        .eq('status', 'scheduled')
        .gte('event_start_time', new Date().toISOString())
        .maybeSingle();

      if (error) {
        console.error('Error checking active consultation:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Client service error:', error);
      return false;
    }
  }

  async getUpcomingConsultation(clientId: string): Promise<Consultation | null> {
    try {
      const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'scheduled')
        .gte('event_start_time', new Date().toISOString())
        .order('event_start_time', { ascending: true })
        .maybeSingle();

      if (error) {
        console.error('Error fetching upcoming consultation:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Client service error:', error);
      return null;
    }
  }

  async getAllConsultations(): Promise<Consultation[]> {
    try {
      const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .order('event_start_time', { ascending: false });

      if (error) {
        console.error('Error fetching all consultations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Client service error:', error);
      return [];
    }
  }

  async getConsultationStats(): Promise<{
    totalConsultations: number;
    scheduledConsultations: number;
    completedConsultations: number;
    cancelledConsultations: number;
    consultationRevenue: number;
    profileRevenue: number;
  }> {
    try {
      const { data: consultations } = await supabase
        .from('consultations')
        .select('status');

      const { data: transactions } = await supabase
        .from('payment_transactions')
        .select('product_type, amount');

      const consultationStats = (consultations || []).reduce(
        (acc, consultation) => {
          acc.totalConsultations++;
          if (consultation.status === 'scheduled') acc.scheduledConsultations++;
          if (consultation.status === 'completed') acc.completedConsultations++;
          if (consultation.status === 'cancelled') acc.cancelledConsultations++;
          return acc;
        },
        { totalConsultations: 0, scheduledConsultations: 0, completedConsultations: 0, cancelledConsultations: 0 }
      );

      const revenueStats = (transactions || []).reduce(
        (acc, transaction) => {
          if (transaction.product_type === 'consultation') {
            acc.consultationRevenue += Number(transaction.amount || 0);
          } else if (transaction.product_type === 'profile_retention') {
            acc.profileRevenue += Number(transaction.amount || 0);
          }
          return acc;
        },
        { consultationRevenue: 0, profileRevenue: 0 }
      );

      return {
        ...consultationStats,
        ...revenueStats,
      };
    } catch (error) {
      console.error('Error fetching consultation stats:', error);
      return {
        totalConsultations: 0,
        scheduledConsultations: 0,
        completedConsultations: 0,
        cancelledConsultations: 0,
        consultationRevenue: 0,
        profileRevenue: 0,
      };
    }
  }
}

export const clientService = new ClientService();
