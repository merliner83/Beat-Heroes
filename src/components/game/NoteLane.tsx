"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface NoteLaneProps {
  notes: number[];
  currentTime: number;
  bpm: number;
  resolution: number;
  isActive: boolean;
  color: string;
}

export const NoteLane: React.FC<NoteLaneProps> = ({
  notes,
  currentTime,
  bpm,
  resolution,
  isActive,
  color,
}) => {
  const secondsPerBeat = 60 / bpm;
  const secondsPerStep = secondsPerBeat / (resolution / 4);
  
  // Pixels per second
  const speed = 400; 
  const viewportHeight = 600;

  return (
    <div className="relative h-full w-full border-x border-white/5 overflow-hidden">
      {notes.map((step, idx) => {
        const noteTime = step * secondsPerStep;
        const relativeTime = noteTime - currentTime;
        
        // Only render notes in view
        if (relativeTime < -0.5 || relativeTime > 2) return null;

        const top = viewportHeight - (relativeTime * speed) - 40; // 40 is half hit zone

        return (
          <div
            key={idx}
            className={cn(
              "absolute left-1/2 -translate-x-1/2 w-12 h-4 rounded-full neon-glow transition-opacity",
              isActive ? "opacity-100" : "opacity-30"
            )}
            style={{ 
              top: `${top}px`,
              backgroundColor: color,
              boxShadow: `0 0 15px ${color}`
            }}
          />
        );
      })}
    </div>
  );
};