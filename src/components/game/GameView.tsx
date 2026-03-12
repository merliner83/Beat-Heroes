
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Project, Level, Sound, GameScore, SoundType } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { SamplerPad } from './SamplerPad';
import { NoteLane } from './NoteLane';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, RotateCcw, Trophy, Home, Loader2, Music2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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

const PASS_THRESHOLD = 90;

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
  const [loadStates, setLoadStates] = useState<Record<string, string>>({});
  const frameRef = useRef<number>(null);
  const { toast } = useToast();

  useEffect(() => {
    const urls = [project.backingTrackUrl, ...sounds.map(s => s.sampleUrl)];
    if (audioEngine) {
      audioEngine.preloadAudio(urls);
    }

    const interval = setInterval(() => {
      if (audioEngine) {
        const newStates: Record<string, string> = {};
        urls.forEach(url => {
          newStates[url] = audioEngine.getLoadStatus(url);
        });
        setLoadStates(newStates);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [project, sounds]);

  const backingTrackReady = loadStates[project.backingTrackUrl] === 'ready';
  const backingTrackFailed = loadStates[project.backingTrackUrl] === 'failed';

  const checkIsPlayable = (type: SoundType, difficulty: number) => {
    if (difficulty === 1) return type === 'kick';
    if (difficulty === 2) return type === 'kick' || type === 'clap';
    if (difficulty === 3) return type === 'kick' || type === 'clap' || type === 'percs';
    return true; 
  };

  const startMission = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    
    try {
      const isResumed = await audioEngine.resume();
      if (!isResumed) throw new Error("AudioContext failed to resume");

      setScore({ hits: 0, misses: 0, accuracy: 100 });
      setIsFinished(false);
      
      if (backingTrackReady) {
        await audioEngine.startBackingTrack(project.backingTrackUrl);
      }
      
      setIsPlaying(true);
    } catch (e) {
      console.error("Game startup failed", e);
      toast({
        variant: "destructive",
        title: "Audio Fehler",
        description: "Das Audiosystem konnte nicht gestartet werden.",
      });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handlePadPress = (type: SoundType) => {
    if (!audioEngine) return;

    const isPlayable = checkIsPlayable(type, level.difficulty);
    if (!isPlayable) return;

    const sound = sounds.find(s => s.type === type);
    if (sound) {
      audioEngine.playOneShot(sound.sampleUrl);
    }

    if (isPlaying && sound) {
      const time = audioEngine.getCurrentTime();
      // Synchronisation mit dem visuellen Offset (0.05s) aus NoteLane.tsx
      const adjustedTime = time - 0.05;
      
      const secondsPerBeat = 60 / project.bpm;
      const secondsPerStep = secondsPerBeat / 4;
      const currentStep = adjustedTime / secondsPerStep;
      
      // Etwas toleranteres Fenster (0.4 Steps ~ 50-80ms je nach BPM)
      const tolerance = 0.4;
      
      const isHit = sound.triggerSteps.some(step => {
        const relativeStep = currentStep % 16;
        const diff = Math.abs(relativeStep - step);
        // Zirkuläre Differenz für Bar-Übergänge
        const circularDiff = Math.min(diff, 16 - diff);
        return circularDiff <= tolerance;
      });

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
          // Level endet nach 60 Sekunden
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
    };
  }, [isPlaying]);

  const isPassed = score.accuracy >= PASS_THRESHOLD;

  return (
    <div className="flex flex-col h-screen bg-[#1F1A23] text-white p-4 max-w-5xl mx-auto overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <Link href={`/studio/${project.studioId}`}>
          <div className="cursor-pointer">
            <h1 className="text-3xl font-bold tracking-tighter text-[#993DEB] uppercase italic">BeatHero</h1>
            <p className="text-sm opacity-60 font-medium">{project.name} - {level.name}</p>
          </div>
        </Link>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <p className="text-[10px] uppercase opacity-40">Target</p>
            <p className="text-sm font-bold opacity-60">{PASS_THRESHOLD}%+</p>
          </div>
          <div className="text-right border-l border-white/10 pl-6">
            <p className="text-[10px] uppercase opacity-40">Accuracy</p>
            <div className="flex items-center gap-2">
              <p className={cn(
                "text-2xl font-bold transition-colors",
                isPassed ? "text-[#00E676]" : "text-[#FF3D00]"
              )}>
                {score.accuracy}%
              </p>
              {isPlaying && (
                <Badge variant={isPassed ? "default" : "destructive"} className="text-[8px] h-4 px-1.5 uppercase font-bold">
                  {isPassed ? "On Track" : "Low"}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 bg-black/40 rounded-2xl border border-white/5 overflow-hidden flex flex-col">
        <div 
          className="absolute left-0 right-0 h-px bg-[#993DEB] opacity-50 z-10"
          style={{ top: '500px', boxShadow: '0 0 10px #993DEB' }}
        />

        <div className="flex-1 flex px-4 relative">
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

        <div className="p-8 bg-black/20 border-t border-white/5 flex flex-col gap-4">
          <div className="flex justify-center gap-4">
            {(['kick', 'clap', 'percs', 'misc'] as SoundType[]).map((type) => {
              const sound = sounds.find(s => s.type === type);
              const status = loadStates[sound?.sampleUrl || ''];
              const isPlayable = checkIsPlayable(type, level.difficulty);
              
              return (
                <div key={type} className="flex flex-col items-center gap-2 w-full max-w-[140px]">
                  <SamplerPad
                    label={type}
                    shortcut={SHORTCUTS[type]}
                    onPress={() => handlePadPress(type)}
                    color={PAD_COLORS[type]}
                    isInactive={!isPlayable}
                  />
                  {isPlayable && (
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold opacity-60">
                      {status === 'ready' && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                      {status === 'failed' && <AlertCircle className="w-3 h-3 text-destructive" />}
                      {status === 'loading' && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>{status === 'ready' ? 'Ready' : (status || 'Idle')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {!isPlaying && !isFinished && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="p-10 bg-[#1F1A23] border-[#993DEB] border text-center max-w-sm">
              <Music2 className="w-12 h-12 text-[#993DEB] mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Bereit?</h2>
              
              <div className="flex flex-col gap-2 mb-8">
                <p className="text-sm opacity-70">Schalte das Audio frei, um die Mission zu starten.</p>
                <div className="flex items-center justify-center gap-2 py-2 px-4 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-[10px] uppercase opacity-50">Musik:</span>
                  {backingTrackReady ? (
                    <span className="text-[10px] text-green-400 font-bold uppercase">Bereit</span>
                  ) : backingTrackFailed ? (
                    <span className="text-[10px] text-destructive font-bold uppercase flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Blockiert (CORS)
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-50 flex items-center gap-1 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" /> Lädt...
                    </span>
                  )}
                </div>
              </div>

              <Button 
                onClick={startMission} 
                disabled={isLoadingAudio || (!backingTrackReady && !backingTrackFailed)}
                className="w-full h-14 text-lg bg-[#993DEB] hover:bg-[#802ECC]"
              >
                {isLoadingAudio ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" /> Bereite vor...
                  </>
                ) : (
                  <>
                    <Play className="mr-2" /> {backingTrackFailed ? "Trotzdem starten" : "Mission starten"}
                  </>
                )}
              </Button>
            </Card>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-8 z-50">
            <div className="max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
              {isPassed ? (
                <>
                  <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                  <h2 className="text-4xl font-bold text-white uppercase italic tracking-tighter">Mission Accomplished</h2>
                  <p className="text-[#00E676] font-bold text-2xl">{score.accuracy}% Genauigkeit</p>
                  <p className="text-white/60 text-sm">Hervorragendes Rhythmusgefühl! Du hast das Ziel von {PASS_THRESHOLD}% erreicht.</p>
                </>
              ) : (
                <>
                  <XCircle className="w-20 h-20 text-[#FF3D00] mx-auto mb-4 drop-shadow-[0_0_15px_rgba(255,61,0,0.5)]" />
                  <h2 className="text-4xl font-bold text-white uppercase italic tracking-tighter">Mission Failed</h2>
                  <p className="text-[#FF3D00] font-bold text-2xl">{score.accuracy}% Genauigkeit</p>
                  <p className="text-white/60 text-sm">Knapp daneben! Du brauchst mindestens {PASS_THRESHOLD}%, um zum nächsten Level zu gelangen.</p>
                </>
              )}
              
              <div className="flex gap-4 pt-6">
                <Button onClick={startMission} variant="outline" className="flex-1 h-12 border-white/20 bg-white/5 hover:bg-white/10">
                  <RotateCcw className="mr-2 h-4 w-4" /> {isPassed ? "Verbessern" : "Erneut versuchen"}
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
    </div>
  );
};
