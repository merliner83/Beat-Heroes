
"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  Cpu, 
  Music, 
  Mic2, 
  Wand2, 
  Disc, 
  Share2, 
  Lock, 
  Sparkles, 
  Play, 
  Gamepad2,
  Headphones,
  Keyboard
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LEARN_CATEGORIES = [
  {
    id: 'intro',
    title: 'Introduction',
    topics: ['Producing', 'Sampling', 'DJing', 'Equipment'],
    icon: BookOpen,
    color: 'text-primary'
  },
  {
    id: 'daws',
    title: 'DAWs',
    topics: ['GarageBand', 'Cubase', 'Ableton Live', 'Audio Logic'],
    icon: Cpu,
    color: 'text-[#00E676]'
  },
  {
    id: 'composing',
    title: 'Composing',
    topics: ['Arrangement', 'Sounddesign'],
    icon: Music,
    color: 'text-[#FFEA00]'
  },
  {
    id: 'recording',
    title: 'Recording',
    topics: ['Basics', 'Instrumente'],
    icon: Mic2,
    color: 'text-[#FF3D00]'
  },
  {
    id: 'effects',
    title: 'Effekte',
    topics: ['Insert-Effekte', 'Send-Effekte', 'Kreative Effekte'],
    icon: Wand2,
    color: 'text-[#3838FA]'
  },
  {
    id: 'djing',
    title: 'DJing',
    topics: ['Techniques', 'Gear', 'Performance'],
    icon: Disc,
    color: 'text-primary'
  },
  {
    id: 'brand',
    title: 'Brand',
    topics: ['Social Media', 'Homepage/App', 'Artwork'],
    icon: Share2,
    color: 'text-[#00FFFF]'
  },
  {
    id: 'release',
    title: 'Release',
    topics: ['Distribution', 'Platforms'],
    icon: Play,
    color: 'text-[#FF9100]'
  },
  {
    id: 'rights',
    title: 'Rechte',
    topics: ['Copyright', 'Licensing'],
    icon: Lock,
    color: 'text-[#EB3D99]'
  },
  {
    id: 'others',
    title: 'Weitere Themen',
    topics: ['AI', 'Free Plugins'],
    icon: Sparkles,
    color: 'text-white'
  }
];

const LEARN_GAMES = [
  { id: 'rhythm', name: 'Rhythm Master', type: 'Learn-Game', icon: Gamepad2, color: '#FF3399', levelId: 'global-rhythm-1' },
  { id: 'ear', name: 'Ear Training', type: 'Learn-Game', icon: Headphones, color: '#00E676', levelId: 'global-ear-1' },
  { id: 'notation', name: 'Notation Pro', type: 'Learn-Game', icon: Keyboard, color: '#FFEA00', levelId: 'global-notation-1' }
];

export const LearnView = () => {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Introduction Header */}
      <section className="relative p-8 rounded-[2rem] bg-gradient-to-br from-primary/10 via-black to-black border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -z-10" />
        <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter mb-4 text-gradient">Master the Lab</h2>
        <p className="text-sm md:text-lg opacity-50 max-w-2xl font-medium tracking-tight">
          Von den ersten Beats bis zum globalen Release – hier lernst du alles, was du für deine Karriere als Musikproduzent wissen musst.
        </p>
      </section>

      {/* Learn In-Apps Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Gamepad2 className="w-5 h-5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Learn-InApps</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {LEARN_GAMES.map((game) => (
            <Link key={game.id} href={`/session/${game.levelId}`}>
              <div className="gemini-border group cursor-pointer transition-transform hover:scale-[1.02] active:scale-95">
                <div className="p-6 bg-black/40 backdrop-blur-xl flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                    <game.icon className="w-8 h-8" style={{ color: game.color }} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black uppercase italic tracking-tighter group-hover:text-primary transition-colors">{game.name}</h4>
                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-30 mt-1">{game.type}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Categories Grid */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Knowledge Base</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {LEARN_CATEGORIES.map((cat) => (
            <Card key={cat.id} className="bg-black/40 border-white/5 hover:border-white/10 transition-all duration-300 group overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
                <div className={cn("p-2.5 rounded-xl bg-white/5 group-hover:scale-110 transition-transform", cat.color)}>
                  <cat.icon className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tighter">{cat.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {cat.topics.map((topic) => (
                    <Badge 
                      key={topic} 
                      variant="outline" 
                      className="bg-white/5 border-white/10 text-[10px] font-bold uppercase tracking-widest px-3 py-1 hover:bg-white/10 transition-colors"
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};
