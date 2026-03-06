"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Song, StemType, GameScore } from '@/lib/game/types';
import { audioEngine } from '@/lib/game/audio-engine';
import { SamplerPad } from './SamplerPad';
import { NoteLane } from './NoteLane';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Play, RotateCcw, Trophy, Sparkles } from 'lucide-react';
import { playerPerformanceFeedback, PlayerPerformanceFeedbackOutput } from '@/ai/flows/player-performance-feedback';

const PAD_COLORS: Record<StemType, string> = {
  kick: '#FF3D00',
  snare: '#00E676',
  perc: '#2979FF',
  hihat: '#FFEA00',
  vocal: '#D500F9',
};

const SHORTCUTS: Record<StemType, string> = {
  kick: 'A',
  snare: 'S',
  perc: 'D',
  hihat: 'F',
  vocal: 'G',
};

export const GameView: React.FC<{ song: Song }> = ({ song }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState<GameScore>({ hits: 0, misses: 0, accuracy: 0 });
  const [feedback, setFeedback] = useState<PlayerPerformanceFeedbackOutput | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  
  const frameRef = useRef<number>(null);

  const startLevel = async () => {
    if (!audioEngine) return;
    const urls = [song.backingTrackUrl, ...song.stems.map(s => s.audioUrl)];
    await audioEngine.preloadAudio(urls);
    audioEngine.start(song.backingTrackUrl, song.stems);
    setIsPlaying(true);
    setIsFinished(false);
    setScore({ hits: 0, misses: 0, accuracy: 100 });
    setFeedback(null);
  };

  const handlePadPress = (type: StemType) => {
    if (!isPlaying || !audioEngine) return;
    
    const time = audioEngine.getCurrentTime();
    const secondsPerBeat = 60 / song.bpm;
    const secondsPerStep = secondsPerBeat / (song.resolution / 4);
    const currentStep = time / secondsPerStep;

    const stem = song.stems.find(s => s.type === type);
    if (!stem) return;

    // Hit detection
    let hit = false;
    for (const noteStep of stem.pattern) {
      if (Math.abs(currentStep - noteStep) <= 0.25) {
        hit = true;
        break;
      }
    }

    setScore(prev => {
      const nextHits = hit ? prev.hits + 1 : prev.hits;
      const nextMisses = hit ? prev.misses : prev.misses + 1;
      const total = nextHits + nextMisses;
      return {
        hits: nextHits,
        misses: nextMisses,
        accuracy: total === 0 ? 100 : Math.round((nextHits / total) * 100),
      };
    });
  };

  useEffect(() => {
    if (isPlaying) {
      const update = () => {
        if (audioEngine) {
          const t = audioEngine.getCurrentTime();
          setCurrentTime(t);
          
          if (t >= song.durationSeconds) {
            finishGame();
            return;
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

  const finishGame = async () => {
    setIsPlaying(false);
    setIsFinished(true);
    audioEngine?.stop();
    
    // Get AI Feedback
    const aiFeedback = await playerPerformanceFeedback({
      songTitle: song.title,
      hits: score.hits,
      misses: score.misses,
      accuracy: score.accuracy,
    });
    setFeedback(aiFeedback);
  };

  return (
    <div className="flex flex-col h-screen bg-[#1F1A23] text-white p-4 max-w-5xl mx-auto overflow-hidden">
      {/* Top Section: Waveform Placeholder & Meta */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter text-[#993DEB] uppercase italic">BeatHero</h1>
          <p className="text-sm opacity-60 font-medium">{song.title} - {song.bpm} BPM</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs uppercase opacity-40">Accuracy</p>
            <p className="text-2xl font-bold text-[#3838FA]">{score.accuracy}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase opacity-40">Time</p>
            <p className="text-2xl font-mono">{Math.floor(currentTime)}s</p>
          </div>
        </div>
      </div>

      <div className="relative flex-1 bg-black/40 rounded-2xl border border-white/5 overflow-hidden flex flex-col">
        {/* Waveform Visualization Placeholder */}
        <div className="h-20 w-full bg-gradient-to-r from-[#993DEB]/20 via-[#3838FA]/20 to-[#993DEB]/20 border-b border-white/5 relative">
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
             <div className="w-full h-[2px] bg-white/50" />
          </div>
          <div 
            className="absolute top-0 bottom-0 w-1 bg-[#993DEB] neon-glow z-10 transition-all duration-100" 
            style={{ left: `${(currentTime / song.durationSeconds) * 100}%` }}
          />
        </div>

        {/* Center: Note Lanes */}
        <div className="flex-1 flex px-4">
          {song.stems.map((stem) => (
            <NoteLane
              key={stem.id}
              notes={stem.pattern}
              currentTime={currentTime}
              bpm={song.bpm}
              resolution={song.resolution}
              isActive={isPlaying}
              color={PAD_COLORS[stem.type]}
            />
          ))}
        </div>

        {/* Bottom: Sampler Pads */}
        <div className="p-8 bg-black/20 border-t border-white/5 flex justify-center gap-4">
          {song.stems.map((stem) => (
            <SamplerPad
              key={stem.id}
              label={stem.type}
              shortcut={SHORTCUTS[stem.type]}
              onPress={() => handlePadPress(stem.type)}
              color={PAD_COLORS[stem.type]}
            />
          ))}
        </div>

        {!isPlaying && !isFinished && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="p-10 bg-[#1F1A23] border-[#993DEB] neon-border text-center max-w-sm">
              <Sparkles className="w-12 h-12 text-[#993DEB] mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Ready to Drop?</h2>
              <p className="text-sm opacity-70 mb-8">Lock in the patterns for {song.title}. Use keys A, S, D, F, G to play.</p>
              <Button onClick={startLevel} className="w-full h-14 text-lg bg-[#993DEB] hover:bg-[#802ECC]">
                <Play className="mr-2" /> Start Mission
              </Button>
            </Card>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md overflow-y-auto p-8 z-50">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center">
                <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <h2 className="text-4xl font-bold mb-1">Session Complete</h2>
                <p className="text-[#3838FA] font-bold text-xl">{score.accuracy}% Precision</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="p-6 bg-white/5 border-white/10">
                  <p className="text-xs opacity-40 uppercase">Hits</p>
                  <p className="text-3xl font-bold text-[#00E676]">{score.hits}</p>
                </Card>
                <Card className="p-6 bg-white/5 border-white/10">
                  <p className="text-xs opacity-40 uppercase">Misses</p>
                  <p className="text-3xl font-bold text-[#FF3D00]">{score.misses}</p>
                </Card>
              </div>

              {feedback ? (
                <Card className="p-8 bg-white/5 border-[#993DEB]/30 space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="text-[#993DEB]" /> BeatBot Feedback
                  </h3>
                  <p className="text-sm leading-relaxed opacity-90">{feedback.overallFeedback}</p>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase text-[#993DEB]">Strengths</p>
                    <ul className="text-sm space-y-1 list-disc list-inside opacity-70">
                      {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase text-[#3838FA]">Pro Tips</p>
                    <ul className="text-sm space-y-1 list-disc list-inside opacity-70">
                      {feedback.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                </Card>
              ) : (
                <div className="h-32 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#993DEB]" />
                </div>
              )}

              <div className="flex gap-4">
                <Button onClick={startLevel} variant="outline" className="flex-1 h-12 border-white/20">
                  <RotateCcw className="mr-2 h-4 w-4" /> Retry Track
                </Button>
                <Button className="flex-1 h-12 bg-[#993DEB] hover:bg-[#802ECC]">
                   Next Mission
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between items-center px-2">
         <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest opacity-40">
           <span>Kick: A</span>
           <span>Snare: S</span>
           <span>Perc: D</span>
           <span>HiHat: F</span>
           <span>Vocal: G</span>
         </div>
         <Progress value={(currentTime / song.durationSeconds) * 100} className="w-48 h-1 bg-white/5" />
      </div>
    </div>
  );
};