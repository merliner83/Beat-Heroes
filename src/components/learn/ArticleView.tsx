
"use client";

import React from 'react';
import { Article } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Video, 
  Image as ImageIcon, 
  Music, 
  FileText, 
  Mic, 
  Scissors, 
  Layers, 
  Sliders, 
  Disc,
  Play
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ArticleViewProps {
  article: Article;
}

const PHASE_ICONS: Record<string, any> = {
  'Composing': Music,
  'Pre-Produktion': FileText,
  'Recording': Mic,
  'Editing': Scissors,
  'Arrangement': Layers,
  'Mixing': Sliders,
  'Mastering': Disc,
};

export const ArticleView: React.FC<ArticleViewProps> = ({ article }) => {
  const renderContent = (content: string) => {
    const blocks = content.split('\n\n');
    return blocks.map((block, idx) => {
      // Check for Phase Card Marker (Format: PHASE:Title|Content)
      if (block.startsWith('PHASE:')) {
        const [titleAndPhase, description] = block.replace('PHASE:', '').split('|');
        const phaseName = titleAndPhase.includes('(') 
          ? titleAndPhase.split('(')[1].replace(')', '').trim()
          : titleAndPhase.trim();
        
        const Icon = PHASE_ICONS[phaseName] || Play;

        return (
          <div key={idx} className="mb-6 gemini-border animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="p-6 bg-black/40 backdrop-blur-xl flex flex-col md:flex-row gap-6">
              <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                <Icon className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h4 className="text-lg font-black uppercase italic tracking-tighter text-white mb-2">{titleAndPhase}</h4>
                <p className="text-sm md:text-base text-white/60 leading-relaxed font-normal">{description}</p>
              </div>
            </div>
          </div>
        );
      }

      // Check for YouTube Link
      const ytMatch = block.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
      
      if (ytMatch) {
        const videoId = ytMatch[1];
        const lines = block.split('\n');
        const titleLine = lines[0].includes('http') ? '' : lines[0];
        
        return (
          <div key={idx} className="my-10 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {titleLine && (
              <h4 className="text-xs font-black uppercase tracking-[0.3em] text-primary/60 italic">{titleLine}</h4>
            )}
            <div className="relative rounded-[2rem] overflow-hidden border border-white/10 bg-black aspect-video shadow-2xl group">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="opacity-80 group-hover:opacity-100 transition-opacity"
              ></iframe>
            </div>
          </div>
        );
      }
      
      // Standard text block
      if (block.startsWith('#')) {
        return (
          <div key={idx} className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white mb-4 pr-10 border-b border-white/5 pb-2">
              {block.replace(/^#+\s*/, '')}
            </h3>
          </div>
        );
      }

      const isIntro = idx === 0;
      
      return (
        <div key={idx} className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <p className={isIntro 
            ? "text-lg md:text-2xl text-white/90 leading-relaxed font-normal pr-8" 
            : "text-base md:text-lg text-white/60 leading-relaxed font-normal pr-8"}>
            {block}
          </p>
        </div>
      );
    });
  };

  const hasVideo = !!article.videoUrl;
  const hasImages = article.imageUrls && article.imageUrls.length > 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary font-body">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />
      
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 p-4 md:p-6">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/5">
              <ArrowLeft className="w-5 h-5 text-white/40" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic">KnowHow Lab</span>
            <h1 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none pr-8">{article.title}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-12 space-y-16 pb-32">
        <section>
          <div className="bg-white/2 border border-white/5 p-8 md:p-12 rounded-[2.5rem] backdrop-blur-sm shadow-2xl">
            {renderContent(article.content)}
          </div>
        </section>

        {hasVideo && (
          <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex items-center gap-3 mb-8 justify-center">
              <Video className="w-5 h-5 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/30 italic">Tutorial Feed</h3>
            </div>
            
            <div className="relative aspect-[9/16] max-w-[400px] mx-auto group">
              <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative h-full w-full bg-black rounded-[3rem] border-8 border-white/10 overflow-hidden shadow-2xl">
                <video 
                  src={article.videoUrl} 
                  controls 
                  className="w-full h-full object-cover"
                  playsInline
                />
              </div>
            </div>
          </section>
        )}

        {hasImages && (
          <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex items-center gap-3 mb-8">
              <ImageIcon className="w-5 h-5 text-[#00E676]" />
              <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/30 italic">Reference Shots</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {article.imageUrls?.map((url, idx) => (
                <div key={idx} className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-white/5 group shadow-xl">
                  <Image 
                    src={url} 
                    alt={`Reference ${idx + 1}`} 
                    fill 
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="fixed bottom-0 w-full p-6 flex justify-center z-[60] pointer-events-none">
        <Link href="/" className="pointer-events-auto">
          <Button className="h-16 px-12 bg-primary hover:bg-primary/90 text-white font-black uppercase italic rounded-full shadow-[0_20px_50px_rgba(255,51,153,0.3)] hover:scale-105 active:scale-95 transition-all">
            Got it, Lab!
          </Button>
        </Link>
      </footer>
    </div>
  );
};
