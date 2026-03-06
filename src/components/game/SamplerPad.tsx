"use client";

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SamplerPadProps {
  label: string;
  shortcut: string;
  onPress: () => void;
  color: string;
}

export const SamplerPad: React.FC<SamplerPadProps> = ({ label, shortcut, onPress, color }) => {
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = () => {
    setIsPressed(true);
    onPress();
    setTimeout(() => setIsPressed(false), 100);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === shortcut.toLowerCase()) {
        handlePress();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcut]);

  return (
    <button
      onMouseDown={handlePress}
      className={cn(
        "relative flex flex-col items-center justify-center aspect-square w-full max-w-[140px] rounded-xl border-2 transition-all duration-75 select-none",
        isPressed 
          ? "scale-95 brightness-125" 
          : "scale-100 hover:brightness-110"
      )}
      style={{
        borderColor: color,
        backgroundColor: isPressed ? color : 'transparent',
        boxShadow: isPressed ? `0 0 40px ${color}` : `0 0 10px ${color}33`,
      }}
    >
      <span className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">{shortcut}</span>
      <span className="text-lg font-bold uppercase">{label}</span>
      
      {/* Decorative neon corner */}
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
    </button>
  );
};