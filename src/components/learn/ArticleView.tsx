
"use client";

import React from 'react';
import { Article } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Layout, Image as ImageIcon, Video } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ArticleViewProps {
  article: Article;
}

export const ArticleView: React.FC<ArticleViewProps> = ({ article }) => {
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
            <h1 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none">{article.title}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-12 space-y-12 pb-32">
        {/* Content Section */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white/2 border border-white/5 p-8 rounded-3xl backdrop-blur-sm">
            <div className="prose prose-invert max-w-none">
              <p className="text-lg md:text-xl text-white/70 leading-relaxed font-medium whitespace-pre-wrap">
                {article.content}
              </p>
            </div>
          </div>
        </section>

        {/* Video Section (Portrait) */}
        {article.videoUrl && (
          <section className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
            <div className="flex items-center gap-3 mb-6">
              <Video className="w-5 h-5 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/30 italic">Tutorial Feed</h3>
            </div>
            
            <div className="relative aspect-[9/16] max-w-[400px] mx-auto group">
              <div className="absolute -inset-2 bg-primary/10 blur-2xl rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative h-full w-full bg-black rounded-[2.5rem] border-4 border-white/10 overflow-hidden shadow-2xl">
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

        {/* Gallery Section */}
        {article.imageUrls && article.imageUrls.length > 0 && (
          <section className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-400">
            <div className="flex items-center gap-3 mb-6">
              <ImageIcon className="w-5 h-5 text-[#00E676]" />
              <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/30 italic">Reference Shots</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {article.imageUrls.map((url, idx) => (
                <div key={idx} className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/5 group">
                  <Image 
                    src={url} 
                    alt={`Reference ${idx + 1}`} 
                    fill 
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    data-ai-hint="music equipment"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="fixed bottom-0 w-full p-6 flex justify-center z-[60] pointer-events-none">
        <Link href="/" className="pointer-events-auto">
          <Button className="h-14 px-10 bg-primary hover:bg-primary/90 text-white font-black uppercase italic rounded-full shadow-[0_15px_40px_rgba(255,51,153,0.3)] hover:scale-105 active:scale-95 transition-all">
            Got it, Lab!
          </Button>
        </Link>
      </footer>
    </div>
  );
};
