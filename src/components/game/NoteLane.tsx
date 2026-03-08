
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface NoteLaneProps {
  notes: number[];
  currentTime: number;
  bpm: number;
  isActive: boolean;
  color: string;
}

export const NoteLane: React.FC<NoteLaneProps> = ({ notes, currentTime, bpm, isActive, color }) => {
  const secondsPerBeat = 60 / bpm;
  const secondsPerStep = secondsPerBeat / 4; // 16th notes
  
  const speed = 400; // pixels per second
  const viewportHeight = 600;

  return (
    <div className="relative h-full w-full border-x border-white/5 overflow-hidden">
      {notes.map((step, idx) => {
        // Map notes to every bar (16 steps)
        return [0, 16, 32, 48].map(barOffset => {
          const noteTime = (step + barOffset) * secondsPerStep;
          const relativeTime = noteTime - currentTime;
          
          if (relativeTime < -0.5 || relativeTime > 2) return null;

          const top = viewportHeight - (relativeTime * speed) - 100;

          return (
            <div
              key={`${idx}-${barOffset}`}
              className={cn(
                "absolute left-1/2 -translate-x-1/2 w-12 h-3 rounded-full transition-opacity",
                isActive ? "opacity-100" : "opacity-30"
              )}
              style={{ 
                top: `${top}px`,
                backgroundColor: color,
                boxShadow: `0 0 15px ${color}`
              }}
            />
          );
        });
      })}
    </div>
  );
};
