"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

export type FlashType = 'hit' | 'miss' | null;

interface SamplerPadProps {
  label: string;
  shortcut: string;
  onPress: () => void;
  color: string;
  isInactive?: boolean;
  flash?: FlashType;
}

export const SamplerPad: React.FC<SamplerPadProps> = ({ label, shortcut, onPress, color, isInactive, flash }) => {
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = useCallback((e?: React.PointerEvent | KeyboardEvent) => {
    if (isInactive) return;
    if (e && 'preventDefault' in e) e.preventDefault();
    
    onPress();
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 80);
  }, [onPress, isInactive]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isInactive && e.key.toLowerCase() === shortcut.toLowerCase()) {
        handlePress(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcut, isInactive, handlePress]);

  return (
    <div className="relative w-full max-w-[140px] aspect-square">
      {/* Visual Feedback Layer */}
      {flash === 'hit' && <div className="absolute inset-0 rounded-xl animate-hit-green z-0" />}
      {flash === 'miss' && <div className="absolute inset-0 rounded-xl animate-miss-red z-0" />}
      
      <button
        onPointerDown={(e) => handlePress(e)}
        className={cn(
          "relative z-10 flex flex-col items-center justify-center w-full h-full rounded-xl border-2 transition-all duration-75 select-none touch-none",
          isPressed 
            ? "scale-95 brightness-125" 
            : "scale-100 hover:brightness-110 active:scale-95",
          isInactive && "opacity-20 border-dashed cursor-not-allowed pointer-events-none"
        )}
        style={{
          borderColor: color,
          backgroundColor: isPressed ? color : 'rgba(0,0,0,0.2)',
          boxShadow: isPressed ? `0 0 40px ${color}` : `0 0 10px ${color}22`,
        }}
        disabled={isInactive}
      >
        <span className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">{shortcut}</span>
        <span className="text-lg font-bold uppercase tracking-tighter">{label}</span>
        <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isInactive ? 'transparent' : color }} />
      </button>
    </div>
  );
};
