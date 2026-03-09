
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Project, Level, Sound, GameScore, SoundType } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { SamplerPad } from './SamplerPad';
import { NoteLane } from './NoteLane';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, RotateCcw, Trophy, Home, Loader2, Music2 } from 'lucide-react';
import Link from 'next/link';

const PAD_COLORS: Record<SoundType, string> = {
  kick: '#FF3D00',
  clap: '#00E676',
  percs: '#FFEA00',
  misc: '#2979FF',
};

const SHORTCUTS: Record<SoundType, string> = {
  kick: 'A',
  clap: 'S',
  percs: 'D',
  misc: 'F',
};

interface GameViewProps {
  project: Project;
  level: Level;
  sounds: Sound[];
}

export const GameView: React.FC<GameViewProps> = ({ project, level, sounds }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState<GameScore>({ hits: 0, misses: 0, accuracy: 100 });
  const [isFinished, setIsFinished] = useState(false);
  const frameRef = useRef<number>(null);

  const startMission = async () => {
    if (!audioEngine) return;
    
    setIsLoadingAudio(true);
    try {
      await audioEngine.resume();
      const urls = [project.backingTrackUrl, ...sounds.map(s => s.sampleUrl)];
      await audioEngine.preloadAudio(urls);
      await audioEngine.startBackingTrack(project.backingTrackUrl);
      
      setIsPlaying(true);
      setIsFinished(false);
      setScore({ hits: 0, misses: 0, accuracy: 100 });
    } catch (e) {
      console.error("Failed to start mission", e);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handlePadPress = async (type: SoundType) => {
    if (!isPlaying || !audioEngine) return;
    
    // Check if playable in this level
    const isPlayable = checkIsPlayable(type, level.difficulty);
    if (!isPlayable) return;

    const sound = sounds.find(s => s.type === type);
    if (sound) {
      // Play sound via engine
      audioEngine.playOneShot(sound.sampleUrl);
      
      const time = audioEngine.getCurrentTime();
      const secondsPerBeat = 60 / project.bpm;
      const secondsPerStep = secondsPerBeat / 4;
      const currentStep = time / secondsPerStep;
      
      const tolerance = 0.35;
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
    } else {
      console.warn(`Sound for type ${type} not found in this level.`);
    }
  };

  // Level Logic for Pad availability
  const checkIsPlayable = (type: SoundType, difficulty: number) => {
    if (difficulty === 1) return type === 'kick';
    if (difficulty === 2) return type === 'clap';
    if (difficulty === 3) return type === 'percs';
    if (difficulty === 4) return true; // All playable for MISC/Full Beat level
    return true;
  };

  useEffect(() => {
    if (isPlaying) {
      const update = () => {
        if (audioEngine) {
          const t = audioEngine.getCurrentTime();
          setCurrentTime(t);
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
        <Link href={`/studio/${project.studioId}`}>
          <div className="cursor-pointer">
            <h1 className="text-3xl font-bold tracking-tighter text-[#993DEB] uppercase italic">BeatHero</h1>
            <p className="text-sm opacity-60 font-medium">{project.name} - {level.name}</p>
          </div>
        </Link>
        <div className="text-right">
          <p className="text-xs uppercase opacity-40">Genauigkeit</p>
          <p className="text-2xl font-bold text-[#3838FA]">{score.accuracy}%</p>
        </div>
      </div>

      <div className="relative flex-1 bg-black/40 rounded-2xl border border-white/5 overflow-hidden flex flex-col">
        <div className="flex-1 flex px-4">
          {(['kick', 'clap', 'percs', 'misc'] as SoundType[]).map((type) => {
            const sound = sounds.find(s => s.type === type);
            const isPlayable = checkIsPlayable(type, level.difficulty);
            return (
              <NoteLane
                key={type}
                notes={sound?.triggerSteps || []}
                currentTime={currentTime}
                bpm={project.bpm}
                isActive={isPlaying && isPlayable}
                color={PAD_COLORS[type]}
              />
            );
          })}
        </div>

        <div className="p-8 bg-black/20 border-t border-white/5 flex justify-center gap-4">
          {(['kick', 'clap', 'percs', 'misc'] as SoundType[]).map((type) => (
            <SamplerPad
              key={type}
              label={type}
              shortcut={SHORTCUTS[type]}
              onPress={() => handlePadPress(type)}
              color={PAD_COLORS[type]}
              disabled={!checkIsPlayable(type, level.difficulty)}
            />
          ))}
        </div>

        {!isPlaying && !isFinished && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="p-10 bg-[#1F1A23] border-[#993DEB] border text-center max-w-sm">
              <Music2 className="w-12 h-12 text-[#993DEB] mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Bereit?</h2>
              <p className="text-sm opacity-70 mb-8">Triff die Noten im Rhythmus. Nutze A, S, D, F.</p>
              <Button 
                onClick={startMission} 
                disabled={isLoadingAudio}
                className="w-full h-14 text-lg bg-[#993DEB] hover:bg-[#802ECC]"
              >
                {isLoadingAudio ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" /> Lade Sounds...
                  </>
                ) : (
                  <>
                    <Play className="mr-2" /> Mission Starten
                  </>
                )}
              </Button>
            </Card>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-8 z-50">
            <div className="max-w-md w-full text-center space-y-6">
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-4xl font-bold">Session Beendet</h2>
              <p className="text-[#3838FA] font-bold text-xl">{score.accuracy}% Präzision</p>
              
              <div className="flex gap-4">
                <Button onClick={startMission} variant="outline" className="flex-1 h-12 border-white/20">
                  <RotateCcw className="mr-2 h-4 w-4" /> Noch mal
                </Button>
                <Link href="/" className="flex-1">
                  <Button className="w-full h-12 bg-[#993DEB] hover:bg-[#802ECC]">
                    <Home className="mr-2 h-4 w-4" /> Home
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
           <span>Percs: D</span>
           <span>Misc: F</span>
        </div>
        <span>{Math.floor(currentTime)}s</span>
      </div>
    </div>
  );
};
