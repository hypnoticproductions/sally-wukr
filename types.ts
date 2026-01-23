
export enum AppPhase {
  PLANNING = 'PLANNING',
  ACTIVATION = 'ACTIVATION',
  SCALING = 'SCALING',
  SOVEREIGN = 'SOVEREIGN'
}

export interface NodeData {
  id: string;
  name: string;
  role: string;
  description: string;
  coordinates: [number, number];
}

export interface ProductData {
  name: string;
  tagline: string;
  description: string;
  icon: string;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}

export type PaymentStatus = 'free' | 'paid' | 'expired';

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  industry?: string;
  pain_points?: string;
  desired_outcome?: string;
  payment_status: PaymentStatus;
  profile_expires_at?: string;
  stripe_customer_id?: string;
  total_paid: number;
  payment_date?: string;
  returning_client: boolean;
  client_value_score: number;
  manus_task_id?: string;
  phone_number?: string;
  phone_verified?: boolean;
  call_preferences?: {
    do_not_call: boolean;
    preferred_time: string;
    timezone: string;
  };
  last_call_at?: string;
  next_follow_up?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  client_id: string;
  stripe_payment_intent_id: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  payment_method?: string;
  refund_reason?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export enum ConversationPhase {
  GREETING = 'GREETING',
  DISCOVERY = 'DISCOVERY',
  READY_FOR_PITCH = 'READY_FOR_PITCH',
  PITCHING = 'PITCHING',
  PAYMENT_OFFERED = 'PAYMENT_OFFERED',
  PAID = 'PAID',
  DECLINED = 'DECLINED'
}
