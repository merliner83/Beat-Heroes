import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MOCK_STUDIOS } from '@/lib/game/mock-data';
import { Music, Play, User, BarChart3, Radio } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#1F1A23]">
      {/* Header */}
      <header className="px-8 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Radio className="text-[#993DEB]" />
          <h1 className="text-2xl font-bold tracking-tighter uppercase italic text-white">BeatHero</h1>
        </div>
        <div className="flex gap-6 items-center">
          <Link href="/leaderboard" className="text-sm font-medium opacity-60 hover:opacity-100 transition-opacity">Leaderboard</Link>
          <Button variant="outline" className="border-[#993DEB]/30 hover:bg-[#993DEB]/10 text-white rounded-full px-6">
            <User className="mr-2 h-4 w-4" /> My Profile
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="px-8 py-12">
        <div className="max-w-4xl">
          <h2 className="text-6xl font-bold text-white tracking-tight leading-tight mb-6">
            Master the <span className="text-[#993DEB]">MPC</span>.<br />
            Rule the <span className="text-[#3838FA]">Rhythm</span>.
          </h2>
          <p className="text-xl text-white/60 mb-8 max-w-2xl">
            BeatHero is the ultimate music production game for the next generation of creators. 
            Tap your way through legendary studios and learn the art of the beat.
          </p>
        </div>
      </section>

      {/* Studios Grid */}
      <section className="px-8 pb-20">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#993DEB] mb-8">Select Your Studio</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {MOCK_STUDIOS.map((studio) => (
            <Link key={studio.id} href={`/game/s1`}>
              <Card 
                className="group relative h-80 overflow-hidden border-none cursor-pointer transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: studio.coverColor }}
              >
                {/* Background Noise/Gradient */}
                <div className="absolute inset-0 bg-black/40 mix-blend-overlay opacity-50" />
                
                <div className="absolute inset-0 p-6 flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md mb-4">
                      <Music className="text-white w-5 h-5" />
                    </div>
                    <h4 className="text-2xl font-bold text-white mb-2">{studio.name}</h4>
                    <p className="text-white/60 text-sm">{studio.description}</p>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">12 Missions</span>
                    <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <Play className="fill-current w-4 h-4 ml-1" />
                    </div>
                  </div>
                </div>

                {/* Neon Highlight */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-white/30" />
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats Quick Look */}
      <footer className="mt-auto px-8 py-8 border-t border-white/5 bg-black/20">
        <div className="flex gap-12 text-white/40 text-xs font-bold uppercase tracking-widest">
           <div className="flex items-center gap-2">
             <BarChart3 className="w-4 h-4 text-[#3838FA]" />
             <span>Global High Score: 98,400</span>
           </div>
           <div className="flex items-center gap-2">
             <Radio className="w-4 h-4 text-[#993DEB]" />
             <span>Currently Playing: 1,402 Users</span>
           </div>
        </div>
      </footer>
    </div>
  );
}