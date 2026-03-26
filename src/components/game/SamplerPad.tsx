
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

export type FlashType = 'hit' | 'miss' | null;

interface SamplerPadProps {
  label: string;
  shortcut: string;
  onPress: () => void;
  color: string;
  flash?: FlashType;
  flashKey?: number;
}

export const SamplerPad: React.FC<SamplerPadProps> = ({ label, shortcut, onPress, color, flash, flashKey }) => {
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = useCallback((e?: React.PointerEvent | KeyboardEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    onPress();
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 80);
  }, [onPress]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === shortcut.toLowerCase()) {
        handlePress(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, handlePress]);

  return (
    <div className="relative w-full max-w-[120px] aspect-square">
      {flash === 'hit' && <div key={`hit-${flashKey}`} className="absolute inset-0 rounded-2xl animate-hit-green z-0" />}
      {flash === 'miss' && <div key={`miss-${flashKey}`} className="absolute inset-0 rounded-2xl animate-miss-red z-0" />}
      
      <button
        onPointerDown={(e) => handlePress(e)}
        className={cn(
          "relative z-10 flex flex-col items-center justify-center w-full h-full rounded-2xl border-2 transition-all duration-75 select-none touch-none",
          isPressed ? "scale-95 brightness-125 bg-white/20" : "scale-100 hover:brightness-110 active:scale-95"
        )}
        style={{
          borderColor: color,
          backgroundColor: isPressed ? color : 'rgba(0,0,0,0.4)',
          boxShadow: `0 0 15px ${color}22`,
        }}
      >
        <span className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">{shortcut}</span>
        <span className="text-sm md:text-lg font-black uppercase italic tracking-tighter">{label}</span>
      </button>
    </div>
  );
};
