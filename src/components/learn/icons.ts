import {
  BookOpen, Cpu, Music, Mic2, Wand2, Disc, Share2, Scale, Sparkles, Gamepad2, Headphones, Target, Scissors,
} from 'lucide-react';
import type { ComponentType, CSSProperties } from 'react';

export const LEARN_ICONS: Record<string, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  BookOpen, Cpu, Music, Mic2, Wand2, Disc, Share2, Scale, Sparkles, Gamepad2, Headphones, Target, Scissors,
};

export const APP_ICONS: Record<string, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  'ear-training': Headphones,
  'rhythm-trainer': Target,
};

export const APP_COLORS: Record<string, string> = {
  'ear-training': '#00E676',
  'rhythm-trainer': '#FFEA00',
};
