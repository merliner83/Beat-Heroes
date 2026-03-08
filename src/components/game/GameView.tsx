
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Project, Level, Sound, GameScore, SoundType } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { SamplerPad } from './SamplerPad';
import { NoteLane } from './NoteLane';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, RotateCcw, Trophy, Sparkles, Home } from 'lucide-react';
import Link from 'next/link';

const PAD_COLORS: Record<SoundType, string> = {
  kick: '#FF3D00',
  clap: '#00E676',
  hihat: '#FFEA00',
  perc: '#2979FF',
};

const SHORTCUTS: Record<SoundType, string> = {
  kick: 'A',
  clap: 'S',
  hihat: 'D',
  perc: 'F',
};

interface GameViewProps {
  project: Project;
  level: Level;
  sounds: Sound[];
}

export const GameView: React.FC<GameViewProps> = ({ project, level, sounds }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState<GameScore>({ hits: 0, misses: 0, accuracy: 100 });
  const [isFinished, setIsFinished] = useState(false);
  const frameRef = useRef<number>(null);

  const startMission = async () => {
    if (!audioEngine) return;
    const urls = [project.backingTrackUrl, ...sounds.map(s => s.sampleUrl)];
    await audioEngine.preloadAudio(urls);
    audioEngine.startBackingTrack(project.backingTrackUrl);
    setIsPlaying(true);
    setIsFinished(false);
    setScore({ hits: 0, misses: 0, accuracy: 100 });
  };

  const handlePadPress = (type: SoundType) => {
    if (!isPlaying || !audioEngine) return;
    
    // Play sound immediately (Live Trigger)
    const sound = sounds.find(s => s.type === type);
    if (sound) {
      audioEngine.playOneShot(sound.sampleUrl);
      
      // Calculate hit detection based on 16th notes
      const time = audioEngine.getCurrentTime();
      const secondsPerBeat = 60 / project.bpm;
      const secondsPerStep = secondsPerBeat / 4; // 16th notes
      const currentStep = time / secondsPerStep;
      
      const tolerance = 0.3; // tolerance in steps
      const isHit = sound.triggerSteps.some(step => Math.abs(currentStep % 16 - step) <= tolerance);

      setScore(prev => {
        const nextHits = isHit ? prev.hits + 1 : prev.hits;
        const nextMisses = isHit ? prev.misses : prev.misses + 1;
        const total = nextHits + nextMisses;
        return {
          hits: nextHits,
          misses: nextMisses,
          accuracy: total === 0 ? 100 : Math.round((nextHits / total) * 100),
        };
      });
    }
  };

  useEffect(() => {
    if (isPlaying) {
      const update = () => {
        if (audioEngine) {
          const t = audioEngine.getCurrentTime();
          setCurrentTime(t);
          // Auto-finish after 32 bars or so? Or manual. Let's say 60s for now.
          if (t >= 60) {
            setIsPlaying(false);
            setIsFinished(true);
            audioEngine.stop();
          }
        }
        frameRef.current = requestAnimationFrame(update);
      };
      frameRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      audioEngine?.stop();
    };
  }, [isPlaying]);

  return (
    <div className="flex flex-col h-screen bg-[#1F1A23] text-white p-4 max-w-5xl mx-auto overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter text-[#993DEB] uppercase italic">BeatHero</h1>
          <p className="text-sm opacity-60 font-medium">{project.name} - Level {level.difficulty}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs uppercase opacity-40">Accuracy</p>
            <p className="text-2xl font-bold text-[#3838FA]">{score.accuracy}%</p>
          </div>
        </div>
      </div>

      <div className="relative flex-1 bg-black/40 rounded-2xl border border-white/5 overflow-hidden flex flex-col">
        {/* Note Lanes (Simplified for production feel) */}
        <div className="flex-1 flex px-4">
          {sounds.map((sound) => (
            <NoteLane
              key={sound.id}
              notes={sound.triggerSteps}
              currentTime={currentTime}
              bpm={project.bpm}
              isActive={isPlaying}
              color={PAD_COLORS[sound.type]}
            />
          ))}
        </div>

        {/* Sampler Pads */}
        <div className="p-8 bg-black/20 border-t border-white/5 flex justify-center gap-4">
          {(['kick', 'clap', 'hihat', 'perc'] as SoundType[]).map((type) => (
            <SamplerPad
              key={type}
              label={type}
              shortcut={SHORTCUTS[type]}
              onPress={() => handlePadPress(type)}
              color={PAD_COLORS[type]}
            />
          ))}
        </div>

        {!isPlaying && !isFinished && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="p-10 bg-[#1F1A23] border-[#993DEB] border text-center max-w-sm">
              <Sparkles className="w-12 h-12 text-[#993DEB] mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Ready to Drop?</h2>
              <p className="text-sm opacity-70 mb-8">Lock in the patterns. Use keys A, S, D, F to play live.</p>
              <Button onClick={startMission} className="w-full h-14 text-lg bg-[#993DEB] hover:bg-[#802ECC]">
                <Play className="mr-2" /> Start Mission
              </Button>
            </Card>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-8 z-50">
            <div className="max-w-md w-full text-center space-y-6">
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-4xl font-bold">Session Complete</h2>
              <p className="text-[#3838FA] font-bold text-xl">{score.accuracy}% Precision</p>
              
              <div className="flex gap-4">
                <Button onClick={startMission} variant="outline" className="flex-1 h-12 border-white/20">
                  <RotateCcw className="mr-2 h-4 w-4" /> Retry
                </Button>
                <Link href="/" className="flex-1">
                  <Button className="w-full h-12 bg-[#993DEB] hover:bg-[#802ECC]">
                    <Home className="mr-2 h-4 w-4" /> Finish
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between items-center px-2 text-[10px] font-bold uppercase tracking-widest opacity-40">
        <div className="flex gap-4">
           <span>Kick: A</span>
           <span>Clap: S</span>
           <span>HiHat: D</span>
           <span>Perc: F</span>
        </div>
        <span>Playback: {Math.floor(currentTime)}s</span>
      </div>
    </div>
  );
};
