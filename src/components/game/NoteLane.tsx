
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
  const hitPosition = 500; 
  const VISUAL_OFFSET = 0.05; 
  const LOOP_STEPS = 128; // 8 Takte à 16 Steps

  return (
    <div className="relative h-full w-full border-x border-white/5 overflow-hidden group">
      {/* Statische Ziel-Zone */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-14 h-4 rounded-full border-2 opacity-20"
        style={{ 
          top: `${hitPosition - 8}px`,
          borderColor: color,
          boxShadow: `0 0 10px ${color}`
        }}
      />

      {/* Fallende Noten */}
      {notes.map((step, idx) => {
        // Rendere das Muster für den aktuellen und den nächsten 8-Takt-Block
        return [0, LOOP_STEPS].map(offset => {
          const noteTime = (step + offset) * secondsPerStep;
          const relativeTime = noteTime - (currentTime - VISUAL_OFFSET);
          
          if (relativeTime < -0.5 || relativeTime > 2.5) return null;

          const top = hitPosition - (relativeTime * speed) - 6;

          return (
            <div
              key={`${idx}-${offset}`}
              className={cn(
                "absolute left-1/2 -translate-x-1/2 w-14 h-3 rounded-full transition-opacity",
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
