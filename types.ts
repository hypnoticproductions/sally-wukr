
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
