
import React from 'react';
import { Shield, Radio, Anchor, Zap, Cpu, Globe, MapPin, Briefcase } from 'lucide-react';

export const AXIS_NODES = [
  {
    id: 'st-lucia',
    name: 'St. Lucia',
    role: 'The Brain / HQ',
    description: 'Cognitive center where Engine Two generates cultural signal.',
    icon: <Cpu className="w-6 h-6" />,
    color: '#D4AF37'
  },
  {
    id: 'barbados',
    name: 'Barbados',
    role: 'The Bank / Hub',
    description: 'Capital aggregation layer for diaspora wealth management.',
    icon: <Briefcase className="w-6 h-6" />,
    color: '#D4AF37'
  },
  {
    id: 'ghana',
    name: 'Ghana',
    role: 'The Bridge / Gate',
    description: 'Ancestral validation node and cultural soft landing.',
    icon: <Globe className="w-6 h-6" />,
    color: '#D4AF37'
  },
  {
    id: 'uganda',
    name: 'Uganda',
    role: 'The Source / Forge',
    description: 'Value lock node where raw resources meet bio-neural engineering.',
    icon: <Anchor className="w-6 h-6" />,
    color: '#D4AF37'
  }
];

export const PRODUCTS = [
  {
    id: 'wukr-wire',
    name: 'WUKR Wire',
    tagline: 'Autonomous Syndication',
    description: 'AI-driven content engine that listens to the cultural signal 24/7.',
    icon: <Radio className="w-6 h-6 text-gold-500" />
  },
  {
    id: 'safe-travel',
    name: 'SafeTravel',
    tagline: 'Predictive Intelligence',
    description: 'Behavioral-adaptive safety profiling with 15-minute data refresh.',
    icon: <Shield className="w-6 h-6 text-gold-500" />
  },
  {
    id: 'harvester',
    name: 'Harvester',
    tagline: 'Legal Intelligence',
    description: 'Autonomous legal frameworking for sovereignty-first businesses.',
    icon: <Zap className="w-6 h-6 text-gold-500" />
  }
];

export const SYSTEM_METRICS = {
  coherenceScore: 78,
  phase: 'SCALING',
  activeUsers: '1,240',
  dataPoints: '2.4M'
};
