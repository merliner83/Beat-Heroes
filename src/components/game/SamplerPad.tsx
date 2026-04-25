
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
    setTimeout(() => setIsPressed(false), 100);
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
    <div className="relative w-full max-w-[120px] aspect-square select-none touch-none">
      {/* Wave Flash Overlay */}
      {flash && (
        <div 
          key={flashKey} 
          className={cn(
            "absolute inset-0 rounded-2xl pointer-events-none z-0",
            flash === 'hit' && "animate-wave-green",
            flash === 'miss' && "animate-wave-red"
          )} 
        />
      )}
      
      <button
        onPointerDown={(e) => handlePress(e)}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "relative z-10 flex flex-col items-center justify-center w-full h-full rounded-2xl border-2 transition-all duration-75 select-none touch-none outline-none",
          isPressed ? "scale-90 brightness-125" : "scale-100 hover:brightness-110 active:scale-90"
        )}
        style={{
          borderColor: color,
          backgroundColor: isPressed ? color : 'rgba(0,0,0,0.6)',
          boxShadow: isPressed ? `0 0 20px ${color}` : `0 0 10px ${color}33`,
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
      >
        <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest opacity-40 mb-2 pointer-events-none">{shortcut}</span>
        <span className="text-[11px] md:text-sm font-black uppercase italic tracking-tighter line-clamp-1 pointer-events-none">{label}</span>
      </button>
    </div>
  );
};
