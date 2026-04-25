
"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { SYNC_OFFSET } from './GameView';

interface NoteLaneProps {
  notes: number[];
  currentTime: number;
  bpm: number;
  isActive: boolean;
  color: string;
  hitPosition: number;
}

export const NoteLane: React.FC<NoteLaneProps> = ({ notes, currentTime, bpm, isActive, color, hitPosition }) => {
  const secondsPerBeat = 60 / bpm;
  const secondsPerStep = secondsPerBeat / 4; // 16th notes
  
  const speed = 400; // pixels per second

  return (
    <div className="relative h-full w-full border-x border-white/5 overflow-hidden group select-none">
      {/* Visual Marker on the lane itself */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-full h-[2px] opacity-10"
        style={{ 
          top: `${hitPosition}px`,
          backgroundColor: color,
        }}
      />

      {/* Falling Notes */}
      {notes.map((step, idx) => {
        const noteTime = step * secondsPerStep;
        // Synchronized relative time including latency offset
        const relativeTime = noteTime - (currentTime - SYNC_OFFSET);
        
        // Culling: Prevent rendering of notes far outside the viewport
        if (relativeTime < -2.0 || relativeTime > 2.5) return null;

        const top = hitPosition - (relativeTime * speed) - 6;

        return (
          <div
            key={idx}
            className={cn(
              "absolute left-1/2 -translate-x-1/2 w-14 h-4 rounded-full transition-opacity shadow-lg",
              isActive ? "opacity-100" : "opacity-30",
              relativeTime < 0 && "opacity-20 blur-[2px]" // Fade and blur slightly when passed the hit point
            )}
            style={{ 
              top: `${top}px`,
              backgroundColor: color,
              boxShadow: `0 0 20px ${color}`,
              zIndex: relativeTime < 0 ? 5 : 10 // Ensure they go "under" the hit marker logic if needed, but above background
            }}
          />
        );
      })}
    </div>
  );
};
