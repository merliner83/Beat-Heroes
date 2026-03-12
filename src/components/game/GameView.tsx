
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Project, Level, Sound, GameScore, SoundType, TriggerPattern } from '@/lib/game/types';
import { audioEngine, AudioEngine } from '@/lib/game/audio-engine';
import { SamplerPad } from './SamplerPad';
import { NoteLane } from './NoteLane';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, RotateCcw, Trophy, Home, Loader2, Music2, CheckCircle2, AlertCircle, XCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

const PAD_COLORS: Record<SoundType, string> = {
  kick: '#993DEB',
  clap: '#FF3D00',
  percs: '#FFEA00',
  misc: '#FFFF00',
};

const SHORTCUTS: Record<SoundType, string> = {
  kick: 'A',
  clap: 'S',
  percs: 'D',
  misc: 'F',
};

const PASS_THRESHOLD = 90;

const DIFFICULTY_REWARDS: Record<number, number> = {
  1: 50,
  2: 100,
  3: 200,
  4: 1000,
};

interface GameViewProps {
  project: Project;
  level: Level;
  sounds: Sound[];
  patterns: TriggerPattern[];
}

export const GameView: React.FC<GameViewProps> = ({ project, level, sounds, patterns }) => {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState<GameScore>({ hits: 0, misses: 0, accuracy: 100 });
  const [isFinished, setIsFinished] = useState(false);
  const [hasAwardedPoints, setHasAwardedPoints] = useState(false);
  const [loadStates, setLoadStates] = useState<Record<string, string>>({});
  const frameRef = useRef<number>(null);
  const { toast } = useToast();

  // Map 8-bar patterns to sounds
  const soundsWithPatterns = sounds.map(sound => {
    const pattern = patterns.find(p => p.id === sound.patternId);
    return {
      ...sound,
      triggerSteps: pattern ? pattern.steps : []
    };
  });

  useEffect(() => {
    const urls = [project.backingTrackUrl, ...sounds.map(s => s.sampleUrl), AudioEngine.METRONOME_URL];
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
  const metronomeReady = loadStates[AudioEngine.METRONOME_URL] === 'ready';

  const checkIsPlayable = (type: SoundType, difficulty: number) => {
    if (difficulty === 1) return type === 'kick';
    if (difficulty === 2) return type === 'kick' || type === 'clap';
    if (difficulty === 3) return type === 'kick' || type === 'clap' || type === 'percs';
    return true; 
  };

  const handlePadPress = useCallback((type: SoundType) => {
    if (!audioEngine) return;

    const isPlayable = checkIsPlayable(type, level.difficulty);
    if (!isPlayable) return;

    const sound = soundsWithPatterns.find(s => s.type === type);
    if (sound) {
      audioEngine.playOneShot(sound.sampleUrl);
    }

    if (isPlaying && sound) {
      const time = audioEngine.getCurrentTime();
      // Adjust for visual sync and latency
      const adjustedTime = time - 0.05; 
      
      const secondsPerBeat = 60 / project.bpm;
      const secondsPerStep = secondsPerBeat / 4;
      const currentStep = adjustedTime / secondsPerStep;
      
      const tolerance = 0.5; // Tighter hit window for 8-bar patterns
      
      const isHit = sound.triggerSteps.some(step => {
        const relativeStep = currentStep % 128; // Strict 8-bar loop
        const diff = Math.abs(relativeStep - step);
        const circularDiff = Math.min(diff, 128 - diff);
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
  }, [isPlaying, soundsWithPatterns, level.difficulty, project.bpm]);

  const startLevel = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    
    try {
      const isResumed = await audioEngine.resume();
      if (!isResumed) throw new Error("AudioContext failed to resume");

      setScore({ hits: 0, misses: 0, accuracy: 100 });
      setIsFinished(false);
      setHasAwardedPoints(false);
      
      const secondsPerBeat = 60 / project.bpm;
      const countInDuration = 4 * secondsPerBeat;
      const now = audioEngine.getContextTime();
      const actualStartTime = now + countInDuration;
      
      audioEngine.setStartTime(actualStartTime);
      setIsPlaying(true); 

      if (metronomeReady) {
        await audioEngine.playCountIn(project.bpm, (beat) => {
          setCountIn(5 - beat); 
        });
        setCountIn(null);
      }
      
      if (backingTrackReady) {
        // Precise start scheduled exactly at actualStartTime
        await audioEngine.startBackingTrack(project.backingTrackUrl, actualStartTime);
      }
      
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Audio Fehler",
        description: "Das Audiosystem konnte nicht gestartet werden.",
      });
      setCountIn(null);
      setIsPlaying(false);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const abortLevel = () => {
    if (audioEngine) {
      audioEngine.stop();
    }
    setIsPlaying(false);
    setIsFinished(false);
    setCountIn(null);
    router.push(`/studio/${project.studioId}`);
  };

  useEffect(() => {
    if (isPlaying) {
      const update = () => {
        if (audioEngine) {
          const t = audioEngine.getCurrentTime();
          setCurrentTime(t);
          // Auto-end after 8 bars loop completion (e.g. 32 beats or just duration)
          // For now we keep 60s as safety buffer
          if (t >= 120) { 
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

  useEffect(() => {
    if (isFinished && isPassed && !hasAwardedPoints && user && db) {
      const reward = DIFFICULTY_REWARDS[level.difficulty] || 0;
      const userRef = doc(db, 'users', user.uid);
      const progressRef = doc(db, 'users', user.uid, 'progress', level.id);
      
      updateDoc(userRef, {
        streetCred: increment(reward)
      }).catch(() => {
        setDoc(userRef, { streetCred: reward }, { merge: true });
      });

      setDoc(progressRef, {
        levelId: level.id,
        accuracy: score.accuracy,
        completedAt: serverTimestamp()
      }, { merge: true });

      setHasAwardedPoints(true);
    }
  }, [isFinished, isPassed, hasAwardedPoints, user, db, level, score.accuracy]);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white p-6 max-w-5xl mx-auto overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-6">
          <Link href={`/studio/${project.studioId}`}>
            <div className="cursor-pointer group">
              <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none group-hover:text-[#993DEB] transition-colors">BeatHero</h1>
              <p className="text-[10px] opacity-40 font-black uppercase tracking-[0.3em] mt-1">{project.name} • {level.name}</p>
            </div>
          </Link>
          {(isPlaying || countIn !== null) && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={abortLevel}
              className="text-[10px] uppercase font-black tracking-widest text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/20 gap-2 px-3 h-8 rounded-full"
            >
              <X className="w-3 h-3" /> Abort
            </Button>
          )}
        </div>
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <p className="text-[10px] uppercase font-black tracking-widest opacity-30">Target</p>
            <p className="text-sm font-black opacity-60 italic">{PASS_THRESHOLD}%+</p>
          </div>
          <div className="text-right border-l border-white/10 pl-8">
            <p className="text-[10px] uppercase font-black tracking-widest opacity-30">Accuracy</p>
            <div className="flex items-center gap-3">
              <p className={cn(
                "text-4xl font-black italic tracking-tighter transition-colors",
                isPassed ? "text-[#00E676]" : "text-[#FF3D00]"
              )}>
                {score.accuracy}%
              </p>
              {isPlaying && (
                <Badge variant={isPassed ? "default" : "destructive"} className="text-[10px] h-5 px-2 uppercase font-black italic rounded-full">
                  {isPassed ? "On Track" : "Low"}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 gemini-border gemini-glow overflow-hidden flex flex-col">
        <div 
          className="absolute left-0 right-0 h-px bg-white/20 z-10"
          style={{ top: '500px' }}
        />

        <div className="flex-1 flex px-4 relative bg-black/40">
          {(['kick', 'clap', 'percs', 'misc'] as SoundType[]).map((type) => {
            const sound = soundsWithPatterns.find(s => s.type === type);
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

        <div className="p-8 bg-black/40 border-t border-white/5 flex flex-col gap-4">
          <div className="flex justify-center gap-6">
            {(['kick', 'clap', 'percs', 'misc'] as SoundType[]).map((type) => {
              const sound = soundsWithPatterns.find(s => s.type === type);
              const status = loadStates[sound?.sampleUrl || ''];
              const isPlayable = checkIsPlayable(type, level.difficulty);
              
              return (
                <div key={type} className="flex flex-col items-center gap-3 w-full max-w-[140px]">
                  <SamplerPad
                    label={type}
                    shortcut={SHORTCUTS[type]}
                    onPress={() => handlePadPress(type)}
                    color={PAD_COLORS[type]}
                    isInactive={!isPlayable}
                  />
                  {isPlayable && (
                    <div className="flex items-center gap-1.5 text-[9px] uppercase font-black tracking-widest opacity-40">
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

        {!isPlaying && !isFinished && countIn === null && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50">
            <Card className="p-12 bg-black border-none gemini-border gemini-glow text-center max-w-sm">
              <Music2 className="w-16 h-16 text-[#993DEB] mx-auto mb-6" />
              <h2 className="text-3xl font-black mb-2 uppercase italic tracking-tighter">Ready?</h2>
              
              <div className="flex flex-col gap-3 mb-10">
                <p className="text-sm opacity-50 font-medium">Unlock audio to start the level.</p>
                <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-[10px] uppercase font-black tracking-widest opacity-30">Status:</span>
                  {backingTrackReady ? (
                    <span className="text-[10px] text-green-400 font-black uppercase tracking-widest">Ready</span>
                  ) : (
                    <span className="text-[10px] opacity-30 flex items-center gap-1 animate-pulse font-black uppercase tracking-widest">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading
                    </span>
                  )}
                </div>
              </div>

              <Button 
                onClick={startLevel} 
                disabled={isLoadingAudio || !backingTrackReady}
                className="w-full h-16 text-xl font-black uppercase italic tracking-tighter bg-white text-black hover:bg-white/90 rounded-2xl"
              >
                {isLoadingAudio ? <Loader2 className="animate-spin" /> : "Start Level"}
              </Button>
            </Card>
          </div>
        )}

        {countIn !== null && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50 pointer-events-none">
            <div className="text-[12rem] font-black italic tracking-tighter text-white/80 animate-in zoom-in-50 duration-200 drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]">
              {countIn}
            </div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-8 z-50">
            <div className="max-w-md w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
              {isPassed ? (
                <>
                  <div className="relative inline-block">
                    <Trophy className="w-24 h-24 text-[#FFEA00] mx-auto mb-4 drop-shadow-[0_0_20px_rgba(255,234,0,0.5)]" />
                  </div>
                  <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none">Level Accomplished</h2>
                  <p className="text-[#00E676] font-black text-3xl italic tracking-tighter">{score.accuracy}% Accuracy</p>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 inline-block">
                    <p className="text-[#FFEA00] font-black text-xl tracking-widest uppercase">
                      +{DIFFICULTY_REWARDS[level.difficulty]} <span className="italic">SC</span>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-24 h-24 text-[#FF3D00] mx-auto mb-4 drop-shadow-[0_0_20px_rgba(255,61,0,0.5)]" />
                  <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none">Level Failed</h2>
                  <p className="text-[#FF3D00] font-black text-3xl italic tracking-tighter">{score.accuracy}% Accuracy</p>
                </>
              )}
              
              <div className="flex gap-4 pt-8">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-14 border-white/20 bg-white/5 hover:bg-white/10 rounded-2xl font-black uppercase italic tracking-tighter">
                  <RotateCcw className="mr-2 h-5 w-5" /> Retry
                </Button>
                <Link href={`/studio/${project.studioId}`} className="flex-1">
                  <Button className="w-full h-14 bg-white text-black hover:bg-white/90 rounded-2xl font-black uppercase italic tracking-tighter">
                    <Home className="mr-2 h-5 w-5" /> Studio
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
