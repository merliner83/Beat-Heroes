
"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
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
  Keyboard,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LEARN_CATEGORIES = [
  {
    id: 'intro',
    title: 'Introduction',
    topics: [
      { name: 'Producing', id: 'article-producing' },
      { name: 'Sampling', id: 'article-sampling' },
      { name: 'DJing', id: 'article-djing' },
      { name: 'Equipment', id: 'article-equipment' }
    ],
    icon: BookOpen,
    color: 'text-primary'
  },
  {
    id: 'daws',
    title: 'DAWs',
    topics: [
      { name: 'GarageBand', id: 'article-gb' },
      { name: 'Cubase', id: 'article-cubase' },
      { name: 'Ableton Live', id: 'article-ableton' },
      { name: 'Audio Logic', id: 'article-logic' }
    ],
    icon: Cpu,
    color: 'text-[#00E676]'
  },
  {
    id: 'composing',
    title: 'Composing',
    topics: [
      { name: 'Arrangement', id: 'article-arrangement' },
      { name: 'Sounddesign', id: 'article-sounddesign' }
    ],
    icon: Music,
    color: 'text-[#FFEA00]'
  },
  {
    id: 'recording',
    title: 'Recording',
    topics: [
      { name: 'Basics', id: 'article-rec-basics' },
      { name: 'Instrumente', id: 'article-rec-instruments' }
    ],
    icon: Mic2,
    color: 'text-[#FF3D00]'
  },
  {
    id: 'effects',
    title: 'Effekte',
    topics: [
      { name: 'Insert-Effekte', id: 'article-inserts' },
      { name: 'Send-Effekte', id: 'article-sends' },
      { name: 'Kreative Effekte', id: 'article-creative-fx' }
    ],
    icon: Wand2,
    color: 'text-[#3838FA]'
  },
  {
    id: 'djing',
    title: 'DJing',
    topics: [
      { name: 'Techniques', id: 'article-dj-tech' },
      { name: 'Gear', id: 'article-dj-gear' },
      { name: 'Performance', id: 'article-dj-perf' }
    ],
    icon: Disc,
    color: 'text-primary'
  },
  {
    id: 'brand',
    title: 'Brand',
    topics: [
      { name: 'Social Media', id: 'article-sm' },
      { name: 'Homepage/App', id: 'article-app' },
      { name: 'Artwork', id: 'article-artwork' }
    ],
    icon: Share2,
    color: 'text-[#00FFFF]'
  },
  {
    id: 'release',
    title: 'Release',
    topics: [
      { name: 'Distribution', id: 'article-dist' },
      { name: 'Platforms', id: 'article-platforms' }
    ],
    icon: Play,
    color: 'text-[#FF9100]'
  },
  {
    id: 'rights',
    title: 'Rechte',
    topics: [
      { name: 'Copyright', id: 'article-copyright' },
      { name: 'Licensing', id: 'article-licensing' }
    ],
    icon: Lock,
    color: 'text-[#EB3D99]'
  },
  {
    id: 'others',
    title: 'Weitere Themen',
    topics: [
      { name: 'AI', id: 'article-ai' },
      { name: 'Free Plugins', id: 'article-plugins' }
    ],
    icon: Sparkles,
    color: 'text-white'
  }
];

const LEARN_GAMES = [
  { id: 'rhythm', name: 'Rhythm Master', type: 'Learn-Game', icon: Gamepad2, color: '#FF3399', levelId: 'global-rhythm-1', adminOnly: true },
  { id: 'ear', name: 'Ear Training', type: 'Learn-Game', icon: Headphones, color: '#00E676', levelId: 'global-ear-training', adminOnly: false },
  { id: 'notation', name: 'Notation Pro', type: 'Learn-Game', icon: Keyboard, color: '#FFEA00', levelId: 'global-notation-1', adminOnly: true }
];

export const LearnView = () => {
  const { profile } = useUser();
  const isAdmin = profile?.role === 'admin';

  const isArticleLocked = (articleId: string) => {
    if (isAdmin) return false;
    return articleId !== 'article-producing';
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      <section className="relative p-8 rounded-[2rem] bg-gradient-to-br from-primary/10 via-black to-black border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -z-10" />
        <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter mb-4 text-gradient">Master the Lab</h2>
        <p className="text-sm md:text-lg opacity-50 max-w-2xl font-medium tracking-tight">
          Von den ersten Beats bis zum globalen Release – hier lernst du alles, was du für deine Karriere als Musikproduzent wissen musst.
        </p>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <Gamepad2 className="w-5 h-5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Learn-InApps</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {LEARN_GAMES.map((game) => {
            const isLocked = game.adminOnly && !isAdmin;
            return (
              <Link 
                key={game.id} 
                href={isLocked ? '#' : `/session/${game.levelId}`}
                className={cn(isLocked && "cursor-not-allowed")}
              >
                <div className="gemini-border group transition-transform hover:scale-[1.02] active:scale-95">
                  <div className="p-6 bg-black/40 backdrop-blur-xl flex flex-col items-center text-center gap-4 relative">
                    {isLocked && (
                      <div className="absolute top-4 right-4 text-white/20">
                        <Lock className="w-5 h-5" />
                      </div>
                    )}
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                      <game.icon className={cn("w-8 h-8", isLocked && "opacity-20")} style={{ color: isLocked ? undefined : game.color }} />
                    </div>
                    <div>
                      <h4 className={cn("text-lg font-black uppercase italic tracking-tighter group-hover:text-primary transition-colors", isLocked && "opacity-20")}>
                        {game.name}
                      </h4>
                      <p className="text-[10px] uppercase font-bold tracking-widest opacity-30 mt-1">{game.type}</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-[0.5em] text-white/50">Knowledge Base</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {LEARN_CATEGORIES.map((cat) => (
            <Card key={cat.id} className="bg-black/40 border-white/5 group overflow-hidden rounded-[2rem]">
              <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
                <div className={cn("p-2.5 rounded-xl bg-white/5", cat.color)}>
                  <cat.icon className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tighter">{cat.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cat.topics.map((topic) => {
                  const locked = isArticleLocked(topic.id);
                  return (
                    <Link 
                      key={topic.id} 
                      href={locked ? '#' : `/learn/article/${topic.id}`}
                      className={cn(locked && "cursor-not-allowed")}
                    >
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-primary/10 hover:border-primary/20 transition-all group/topic mb-2 relative">
                        <span className={cn(
                          "text-[11px] font-black uppercase tracking-widest opacity-50 italic transition-all",
                          !locked && "group-hover/topic:opacity-100 group-hover/topic:text-primary",
                          locked && "opacity-10"
                        )}>
                          {topic.name}
                        </span>
                        {locked ? (
                          <Lock className="w-4 h-4 text-white/10" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-white/10 group-hover/topic:text-primary" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};
