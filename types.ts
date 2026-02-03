
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

export type ProductType = 'profile_retention' | 'consultation';

export type ConsultationStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';

export interface Consultation {
  id: string;
  client_id: string;
  event_uri: string;
  invitee_uri: string;
  scheduled_at: string;
  event_start_time?: string;
  event_end_time?: string;
  status: ConsultationStatus;
  meeting_link?: string;
  cancellation_reason?: string;
  canceled_by?: string;
  rescheduled: boolean;
  old_invitee_uri?: string;
  questions_and_answers?: Array<{
    question: string;
    answer: string;
  }>;
  timezone?: string;
  tracking_data?: {
    utm_campaign?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_content?: string;
    utm_term?: string;
  };
  created_at: string;
  updated_at: string;
}

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
  has_active_consultation?: boolean;
  consultation_count?: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  client_id: string;
  product_type: ProductType;
  stripe_payment_intent_id?: string;
  stripe_session_id?: string;
  calendly_event_uri?: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  payment_method?: string;
  refund_reason?: string;
  payment_date: string;
  metadata: Record<string, any>;
  created_at: string;
}

export enum ConversationPhase {
  GREETING = 'GREETING',
  DISCOVERY = 'DISCOVERY',
  READY_FOR_PITCH = 'READY_FOR_PITCH',
  PITCHING = 'PITCHING',
  PAYMENT_OFFERED = 'PAYMENT_OFFERED',
  CONSULTATION_OFFERED = 'CONSULTATION_OFFERED',
  DUAL_OFFER_PRESENTED = 'DUAL_OFFER_PRESENTED',
  PAID = 'PAID',
  DECLINED = 'DECLINED'
}
