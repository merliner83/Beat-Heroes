
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
  const hitPosition = 500; // Position der Urteils-Linie von oben gemessen
  
  // Ein kleiner Versatz (in Sekunden), um die visuelle Latenz auszugleichen (Sync-Fix)
  const VISUAL_OFFSET = 0.05; 

  return (
    <div className="relative h-full w-full border-x border-white/5 overflow-hidden group">
      {/* Statische Ziel-Zone (Ring) */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-14 h-4 rounded-full border-2 opacity-20"
        style={{ 
          top: `${hitPosition - 8}px`, // Zentriert den 16px hohen Ring auf der Linie
          borderColor: color,
          boxShadow: `0 0 10px ${color}`
        }}
      />

      {/* Fallende Noten */}
      {notes.map((step, idx) => {
        // Wir rendern die Noten für mehrere Takte im Voraus (Loop-Simulation)
        return [0, 16, 32, 48, 64, 80].map(barOffset => {
          const noteTime = (step + barOffset) * secondsPerStep;
          // Wir ziehen den Offset ab, damit die Note "später" auf die Linie trifft
          const relativeTime = noteTime - (currentTime - VISUAL_OFFSET);
          
          // Nur Noten rendern, die bald kommen oder gerade vorbei sind
          if (relativeTime < -0.5 || relativeTime > 2) return null;

          // Berechnung: hitPosition ist der Nullpunkt (relativeTime = 0)
          // Wir ziehen 6px ab (Hälfte der h-3 Höhe), damit die MITTE der Note die Linie trifft
          const top = hitPosition - (relativeTime * speed) - 6;

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
