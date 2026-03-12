
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
  const hitPosition = 500; // Position der Urteils-Linie von oben gemessen

  return (
    <div className="relative h-full w-full border-x border-white/5 overflow-hidden group">
      {/* Statische Ziel-Zone (Ring) */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-14 h-4 rounded-full border-2 opacity-20"
        style={{ 
          top: `${hitPosition}px`,
          borderColor: color,
          boxShadow: `0 0 10px ${color}`
        }}
      />

      {/* Fallende Noten */}
      {notes.map((step, idx) => {
        // Wir rendern die Noten für mehrere Takte im Voraus (Loop-Simulation)
        return [0, 16, 32, 48, 64, 80].map(barOffset => {
          const noteTime = (step + barOffset) * secondsPerStep;
          const relativeTime = noteTime - currentTime;
          
          // Nur Noten rendern, die bald kommen oder gerade vorbei sind
          if (relativeTime < -0.5 || relativeTime > 2) return null;

          // Berechnung: hitPosition ist der Nullpunkt (relativeTime = 0)
          const top = hitPosition - (relativeTime * speed);

          return (
            <div
              key={`${idx}-${barOffset}`}
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
