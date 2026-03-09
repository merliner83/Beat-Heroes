
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Project, Level, Sound, GameScore, SoundType } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { SamplerPad } from './SamplerPad';
import { NoteLane } from './NoteLane';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, RotateCcw, Trophy, Home, Loader2, Music2, Activity } from 'lucide-react';
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
  const [audioStatus, setAudioStatus] = useState<any>(null);
  const frameRef = useRef<number>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (audioEngine) {
        setAudioStatus(audioEngine.getAudioStatus());
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const startMission = async () => {
    if (!audioEngine) return;
    setIsLoadingAudio(true);
    
    try {
      const running = await audioEngine.resume();
      if (!running) {
        console.warn("Audio Context could not be started.");
      }

      const urls = [project.backingTrackUrl, ...sounds.map(s => s.sampleUrl)];
      await audioEngine.preloadAudio(urls);
      await audioEngine.startBackingTrack(project.backingTrackUrl);
      
      setIsPlaying(true);
      setIsFinished(false);
      setScore({ hits: 0, misses: 0, accuracy: 100 });
    } catch (e) {
      console.error("Game startup failed", e);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handlePadPress = async (type: SoundType) => {
    if (!audioEngine) return;

    // Force resume on interaction
    audioEngine.resume();

    const sound = sounds.find(s => s.type === type);
    if (sound) {
      // PLAY SOUND REGARDLESS OF LEVEL (Feedback)
      audioEngine.playOneShot(sound.sampleUrl);
      
      // LOGIC FOR SCORING (Only if playable in current level)
      if (isPlaying) {
        const isPlayable = checkIsPlayable(type, level.difficulty);
        if (isPlayable) {
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
        }
      }
    }
  };

  const checkIsPlayable = (type: SoundType, difficulty: number) => {
    if (difficulty === 1) return type === 'kick';
    if (difficulty === 2) return type === 'clap';
    if (difficulty === 3) return type === 'percs';
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
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[10px] uppercase border-white/10 opacity-70 flex gap-1">
                <Activity className="w-3 h-3" />
                Audio: {audioStatus?.state || 'Init'}
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase border-white/10 opacity-70">
                SR: {audioStatus?.sampleRate || '-'}
              </Badge>
            </div>
          </div>
          <div className="text-right border-l border-white/10 pl-4">
            <p className="text-[10px] uppercase opacity-40">Accuracy</p>
            <p className="text-xl font-bold text-[#3838FA]">{score.accuracy}%</p>
          </div>
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
              isInactive={!checkIsPlayable(type, level.difficulty)}
            />
          ))}
        </div>

        {!isPlaying && !isFinished && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="p-10 bg-[#1F1A23] border-[#993DEB] border text-center max-w-sm">
              <Music2 className="w-12 h-12 text-[#993DEB] mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Ready?</h2>
              <p className="text-sm opacity-70 mb-8">Click below to start the mission and unlock audio.</p>
              <Button 
                onClick={startMission} 
                disabled={isLoadingAudio}
                className="w-full h-14 text-lg bg-[#993DEB] hover:bg-[#802ECC]"
              >
                {isLoadingAudio ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" /> Loading...
                  </>
                ) : (
                  <>
                    <Play className="mr-2" /> Start Mission
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
              <h2 className="text-4xl font-bold">Session Complete</h2>
              <p className="text-[#3838FA] font-bold text-xl">{score.accuracy}% Accuracy</p>
              <div className="flex gap-4">
                <Button onClick={startMission} variant="outline" className="flex-1 h-12 border-white/20">
                  <RotateCcw className="mr-2 h-4 w-4" /> Retry
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
