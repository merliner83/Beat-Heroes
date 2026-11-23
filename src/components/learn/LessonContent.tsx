"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Gamepad2, Layers, Mic, Music, Play, Scissors, Sliders, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Darstellung des Lektionstexts. Format (Absätze durch Leerzeile getrennt):
 * # Titel, ## Untertitel, ### Label (oder SUB:), **fett**, ---, GAP: 20,
 * IMAGE: url, VIDEO: url, GAME: learnAppId | Beschriftung,
 * PHASE: Titel | Text | lektionId
 */
const PHASE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = { 'COMPOSING': Music, 'RECORDING': Mic, 'EDITING': Scissors, 'ARRANGEMENT': Layers, 'SOUNDDESIGN': Sparkles, 'MIXING / MASTERING': Sliders };

export function getYouTubeEmbedUrl(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export function LessonContent({ content }: { content: string }) {
  const parseInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-black text-white">{part.slice(2, -2)}</strong>;
      return part;
    });
  };


  const renderLine = (line: string, idx: number) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} className="h-4" />;
    if (trimmed.startsWith('GAP:')) return <div key={idx} style={{ height: `${parseInt(trimmed.replace('GAP:', '').trim()) || 20}px` }} />;
    if (trimmed === '---') return <div key={idx} className="h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent my-10" />;
    if (trimmed.startsWith('VIDEO:')) return <div key={idx} className="mb-8"><div className="relative aspect-[9/16] max-w-[280px] mx-auto bg-black rounded-[2rem] border-4 border-white/10 overflow-hidden shadow-2xl"><video src={trimmed.replace('VIDEO:', '').trim()} controls className="w-full h-full object-cover" playsInline /></div></div>;
    if (trimmed.startsWith('GAME:')) {
      const [appId, label] = trimmed.replace('GAME:', '').split('|').map((p) => p.trim());
      return <Link key={idx} href={`/session/${appId}`} className="mb-8 flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-primary/30 hover:bg-white/10 transition-colors"><div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0"><Gamepad2 className="w-6 h-6 text-primary" /></div><div className="flex-1"><p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Übung</p><p className="font-black text-lg">{label || 'Minigame starten'}</p></div><Play className="w-5 h-5 text-white/60" /></Link>;
    }
    if (trimmed.startsWith('IMAGE:')) return <div key={idx} className="mb-8"><div className="relative w-full rounded-3xl overflow-hidden border border-white/10 shadow-lg bg-white/5"><img src={trimmed.replace('IMAGE:', '').trim()} alt="Content" className="w-full h-auto block" /></div></div>;
    if (trimmed.startsWith('###') || trimmed.startsWith('SUB:')) return <div key={idx} className="mb-4 mt-2"><span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary italic leading-none">{parseInlineFormatting(trimmed.replace(/^###\s*|^SUB:\s*/, ''))}</span></div>;
    if (trimmed.startsWith('##')) return <h4 key={idx} className="text-xl md:text-2xl font-bold tracking-tight text-white/95 mb-6 mt-4 leading-tight">{parseInlineFormatting(trimmed.replace(/^##\s*/, ''))}</h4>;
    if (trimmed.startsWith('#')) return <h3 key={idx} className="text-2xl md:text-4xl font-bold tracking-tight text-white mb-8 border-b border-white/10 pb-4 mt-6 leading-none">{parseInlineFormatting(trimmed.replace(/^#\s*/, ''))}</h3>;
    return <p key={idx} className="text-base md:text-lg text-white/80 leading-relaxed font-normal mb-6 selection:bg-primary/30 whitespace-pre-line">{parseInlineFormatting(line)}</p>;
  };

  const renderContent = (content: string) => {
    if (!content) return null;
    return content.split('\n\n').map((block, bIdx) => {
      const trimmed = block.trim();
      if (trimmed.startsWith('PHASE:')) {
        const parts = trimmed.replace('PHASE:', '').split('|');
        const title = parts[0]?.trim() || '', desc = parts[1]?.trim() || '', linkedId = parts[2]?.trim();
        const Icon = PHASE_ICONS[title.split(':')[0].trim()] || Play;
        return (
          <section key={bIdx} className="mb-14 border-t border-white/10 pt-8">
            <div className="flex items-center gap-5 mb-8"><div className="w-14 h-14 shrink-0 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10"><Icon className="w-7 h-7 text-primary" /></div><h4 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white leading-none">{title}</h4></div>
            <div className="mb-2">{desc.split('\n').map((l, lIdx) => renderLine(l, bIdx * 100 + lIdx))}</div>
            {linkedId && <Link href={`/learn/article/${linkedId}`}><Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 rounded-full px-8 italic font-black uppercase text-xs h-12 mt-6 tracking-widest">Learn More <ArrowRight className="ml-2 w-4 h-4" /></Button></Link>}
          </section>
        );
      }
      return <div key={bIdx} className="mb-2">{trimmed.split('\n').map((l, lIdx) => renderLine(l, bIdx * 100 + lIdx))}</div>;
    });
  };


  return <>{renderContent(content)}</>;
}
