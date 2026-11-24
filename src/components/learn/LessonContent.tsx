"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Download, Drum, ExternalLink, Rocket, Gamepad2, Layers, Lightbulb, ListChecks, Mic, Music, Pin, Play, Scissors, Sliders, Sparkles, Youtube, ListMusic, BookOpen, Headphones, Disc3, Timer, Waves, Speaker, LayoutPanelTop, Pencil, ZoomIn, Wrench, Gauge, Laptop, Cable } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Darstellung des Lektionstexts. Format (Absätze durch Leerzeile getrennt):
 * # Titel, ## Untertitel, ### Label (oder SUB:), **fett**, ---, GAP: 20,
 * IMAGE: url | Bildunterschrift, VIDEO: url, GAME: learnAppId | Beschriftung,
 * YOUTUBE: url | Titel | Beschreibung, INSPIRATION: (gleich, kleine Karte), TIP: art | Titel (+ Textzeilen),
 * PHASE: Titel | Text | lektionId. Baustein-Editor: src/lib/learn/blocks.ts
 */
const PHASE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  COMPOSING: Music, KOMPOSITION: Music, RECORDING: Mic, AUFNAHME: Mic, EDITING: Scissors, ARRANGEMENT: Layers,
  SOUNDDESIGN: Sparkles, 'SOUND DESIGN': Sparkles, IDEE: Sparkles, KLANG: Sparkles, BEAT: Drum, DRUMS: Drum, GROOVE: Drum, RELEASE: Rocket, MIXING: Sliders, MASTERING: Sliders, 'MIXING / MASTERING': Sliders, 'MIXING/MASTERING': Sliders,
  // DJing
  AUSWÄHLEN: ListMusic, GRUNDLAGEN: BookOpen, EQUIPMENT: Headphones, MIXEN: Sliders, SCRATCHEN: Disc3, 'DAS DECK': Disc3,
  'DER MIXER': Sliders, BEATMATCHING: Drum, 'DER RICHTIGE MOMENT': Timer, 'BASS TAUSCHEN': Waves, CONTROLLER: Gamepad2,
  STANDALONE: Disc3, 'CLUB-SETUP': Speaker, PLATTENSPIELER: Disc3, 'FÜR FORTGESCHRITTENE': Sparkles,
  'BABY SCRATCH': Disc3, FORWARD: Disc3, CHIRP: Disc3, TRANSFORMER: Disc3,
  // DAWs
  BENUTZEROBERFLÄCHE: LayoutPanelTop, SPURTYPEN: Layers, SPUREN: Layers, EDITOR: Pencil, ÜBERSICHT: ListMusic,
  TRANSPORT: Play, 'NAVIGATION & ZOOM': ZoomIn, NAVIGATION: ZoomIn, WERKZEUGE: Wrench, BEARBEITEN: Scissors,
  'SPUREN, PROJEKT & TRANSPORT': Layers, 'VOCAL-CHAIN ÜBERSICHT': Mic, EQ: Sliders, 'CHANNEL EQ': Sliders, COMPRESSOR: Gauge,
  GATE: Gauge, 'NOISE GATE': Gauge, 'PITCH CORRECT': Mic, 'PITCH CORRECTION': Mic, DEESSER: Mic, 'DE-ESSER': Mic,
  'HALL UND DELAY': Waves, 'REVERB': Waves, 'DELAY': Waves, MAXIMIZER: Gauge, 'LAUTHEIT MESSEN': Gauge,
  EXPORTIEREN: Download, 'WAS IST MASTERING?': Sliders,
  // Equipment
  'COMPUTER UND DAW': Laptop, KOPFHÖRER: Headphones, 'AUDIO-INTERFACE': Cable, MIKROFONE: Mic, 'STUDIO-MONITORE': Speaker,
  'AKUSTIK UND ZUBEHÖR': Waves, 'UND FÜRS DJING?': Disc3,
};

/** «2. AUFNAHME & EDITING» → «2. Aufnahme & Editing» (Versalien lesen sich schwer). */
function phaseTitle(title: string) {
  if (title !== title.toUpperCase()) return title;
  return title.toLowerCase().replace(/(^|[\s/&(-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
}

/** Icon zur Phase: «2. AUFNAHME» → Mic (Nummer und Zusatz nach «:» zählen nicht). */
function phaseIcon(title: string) {
  const key = title.split(':')[0].replace(/\(\(.*?\)\)/g, '').replace(/^\s*\d+\.\s*/, '').trim().toUpperCase();
  return PHASE_ICONS[key] ?? PHASE_ICONS[key.split(/\s*[/&]\s*/)[0]] ?? Play;
}

/** ID für Sprungmarken aus einem Zwischentitel («Hör zuerst» → «hoer-zuerst»). */
export function headingId(text: string) {
  return 'abschnitt-' + text.replace(/\*\*|\[\[|\]\]/g, '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Gliederung einer Lektion: erster «# Titel» wird zum Seitentitel (und aus
 * dem Text entfernt), «## Zwischentitel» ergeben das Inhaltsverzeichnis.
 */
export function lessonOutline(content: string) {
  const text = content ?? '';
  const m = text.match(/^\s*#(?!#)\s*(.+)\n?/);
  const title = m ? m[1].replace(/\*\*/g, '').trim() : null;
  const body = m ? text.slice(m[0].length) : text;
  const sections = body.split('\n').map((l) => l.trim())
    .filter((l) => /^##(?!#)/.test(l))
    .map((l) => l.replace(/^##\s*/, '').replace(/\*\*|\[\[|\]\]/g, ''))
    .map((t) => ({ id: headingId(t), text: t }));
  const words = body.replace(/^[A-Z]+:.*$/gm, '').split(/\s+/).filter(Boolean).length;
  return { title, body, sections, minutes: Math.max(1, Math.round(words / 180)) };
}

export function getYouTubeEmbedUrl(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

const TIP_STYLE = {
  tipp: { icon: Lightbulb, label: 'Tipp', cls: 'border-info/40 bg-info/10', tone: 'text-info' },
  merke: { icon: Pin, label: 'Merke', cls: 'border-brand/40 bg-brand/10', tone: 'text-brand' },
  achtung: { icon: AlertTriangle, label: 'Achtung', cls: 'border-warning/40 bg-warning/10', tone: 'text-warning' },
  aufgabe: { icon: ListChecks, label: 'Aufgabe', cls: 'border-success/40 bg-success/10', tone: 'text-success' },
} as const;

/** Kleine Video-Karte für weiterführende Inspiration; Klick öffnet den Player darunter. */
function InspirationCard({ url, title, description }: { url: string; title?: string; description?: string }) {
  const [playing, setPlaying] = useState(false);
  const embed = getYouTubeEmbedUrl(url);
  const id = embed?.split('/embed/')[1];
  if (!embed || !id) return null;
  return (
    <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button type="button" onClick={() => setPlaying(!playing)} aria-expanded={playing} className="group w-full flex items-center gap-3 p-2 pr-4 text-left hover:bg-white/[0.04]">
        <span className="relative w-28 md:w-32 aspect-video rounded-lg overflow-hidden bg-black shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" loading="lazy" />
          <span className="absolute inset-0 flex items-center justify-center"><span className="w-8 h-8 rounded-full bg-black/70 flex items-center justify-center"><Play className="w-4 h-4 fill-white text-white ml-0.5" /></span></span>
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wider text-white/60">Inspiration</span>
          {title && <span className="block font-bold leading-snug">{title}</span>}
          {description && <span className="block text-sm text-white/70 mt-0.5 line-clamp-2">{description}</span>}
        </span>
      </button>
      {playing && (
        <div className="aspect-video bg-black">
          <iframe src={`${embed.replace('youtube.com', 'youtube-nocookie.com')}?autoplay=1`} title={title || 'YouTube'} className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      )}
    </div>
  );
}

/** Tutorial-Karte: Vorschaubild + Titel, Klick startet das Video. */
function YouTubeCard({ url, title, description }: { url: string; title?: string; description?: string }) {
  const [playing, setPlaying] = useState(false);
  const embed = getYouTubeEmbedUrl(url);
  const id = embed?.split('/embed/')[1];
  if (!embed || !id) return null;
  return (
    <div className="mb-8 rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
      {playing ? (
        <div className="aspect-video bg-black">
          <iframe src={`${embed.replace('youtube.com', 'youtube-nocookie.com')}?autoplay=1`} title={title || 'YouTube'} className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group relative block w-full aspect-video bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform"><Play className="w-7 h-7 fill-white text-white ml-1" /></span>
          </span>
        </button>
      )}
      {(title || description) && (
        <div className="p-4 flex gap-3">
          <Youtube className="w-5 h-5 text-white/60 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Tutorial</p>
            {title && <p className="font-bold text-lg leading-snug">{title}</p>}
            {description && <p className="text-sm text-white/70 mt-1">{description}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function LessonContent({ content }: { content: string }) {
  const parseInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\[\[.*?\]\]|\(\(.*?\)\)|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g);
    return parts.map((part, i) => {
      const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4 decoration-primary/50 hover:decoration-primary">{link[1]}</a>;
      if (part.startsWith('((') && part.endsWith('))')) return <span key={i} className="text-sm font-normal text-white/60">({part.slice(2, -2)})</span>;
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-black text-white">{part.slice(2, -2)}</strong>;
      if (part.startsWith('[[') && part.endsWith(']]')) return <strong key={i} className="font-bold text-primary">{part.slice(2, -2)}</strong>;
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
      return <Link key={idx} href={`/session/${appId}`} className="mb-8 flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-primary/30 hover:bg-white/10 transition-colors"><div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0"><Gamepad2 className="w-6 h-6 text-primary" /></div><div className="flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Übung</p><p className="font-black text-lg">{label || 'Minigame starten'}</p></div><Play className="w-5 h-5 text-white/60" /></Link>;
    }
    if (trimmed.startsWith('DOWNLOAD:')) {
      const [url, label] = trimmed.replace('DOWNLOAD:', '').split('|').map((p) => p.trim());
      if (!/^https?:\/\//.test(url)) return null;
      let host = url;
      try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* Rohtext */ }
      return (
        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="mb-8 inline-flex items-center gap-3 h-12 px-5 rounded-full bg-white/5 border border-white/15 hover:border-primary hover:bg-white/10 transition-colors font-bold">
          <Download className="w-5 h-5 text-primary" /> {label || host} <ExternalLink className="w-4 h-4 text-white/60" />
        </a>
      );
    }
    if (trimmed.startsWith('INSPIRATION:')) {
      const [url, title, description] = trimmed.replace('INSPIRATION:', '').split('|').map((p) => p.trim());
      return <InspirationCard key={idx} url={url} title={title} description={description} />;
    }
    if (trimmed.startsWith('YOUTUBE:')) {
      const [url, title, description] = trimmed.replace('YOUTUBE:', '').split('|').map((p) => p.trim());
      return <YouTubeCard key={idx} url={url} title={title} description={description} />;
    }
    if (trimmed.startsWith('IMAGE:')) {
      const [src, caption] = trimmed.replace('IMAGE:', '').split('|').map((p) => p.trim());
      return (
        <figure key={idx} className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="relative w-full rounded-3xl overflow-hidden border border-white/10 shadow-lg bg-white/5"><img src={src} alt={caption || ''} className="w-full h-auto block" /></div>
          {caption && <figcaption className="mt-2 text-sm text-white/60 text-center">{caption}</figcaption>}
        </figure>
      );
    }
    if (trimmed.startsWith('###') || trimmed.startsWith('SUB:')) return <div key={idx} className="mb-4 mt-2"><span className="text-xs font-semibold uppercase tracking-wider text-primary italic leading-none">{parseInlineFormatting(trimmed.replace(/^###\s*|^SUB:\s*/, ''))}</span></div>;
    if (trimmed.startsWith('##')) {
      const text = trimmed.replace(/^##\s*/, '');
      return <h2 key={idx} id={headingId(text)} className="scroll-mt-24 text-2xl md:text-3xl font-bold tracking-tight text-white mt-14 mb-5 leading-tight">{parseInlineFormatting(text)}</h2>;
    }
    if (trimmed.startsWith('#')) return <h2 key={idx} className="text-3xl md:text-4xl font-bold tracking-tight text-white mt-14 mb-6 leading-tight">{parseInlineFormatting(trimmed.replace(/^#\s*/, ''))}</h2>;
    const bullet = line.match(/^(\s*)[-•]\s+(.*)$/);
    if (bullet) {
      const nested = bullet[1].length >= 2;
      return (
        <div key={idx} className={cn('flex gap-3 text-[17px] md:text-lg text-white/85 leading-relaxed mb-1.5', nested && 'pl-6 text-base md:text-[17px]')}>
          <span className={cn('mt-[0.7em] shrink-0 rounded-full', nested ? 'w-1 h-1 bg-white/50' : 'w-1.5 h-1.5 bg-primary')} />
          <span className="min-w-0">{parseInlineFormatting(bullet[2])}</span>
        </div>
      );
    }
    return <p key={idx} className="text-[17px] md:text-lg text-white/85 leading-relaxed font-normal mb-5 selection:bg-primary/30 whitespace-pre-line">{parseInlineFormatting(line)}</p>;
  };

  const renderContent = (content: string) => {
    if (!content) return null;
    return content.split(/\n\s*\n/).map((block, bIdx) => {
      const trimmed = block.trim();
      if (trimmed.startsWith('TIP:')) {
        const [head, ...body] = trimmed.split('\n');
        const [kindRaw, title] = head.replace('TIP:', '').split('|').map((p) => p.trim());
        const style = TIP_STYLE[kindRaw as keyof typeof TIP_STYLE] ?? TIP_STYLE.tipp;
        const Icon = style.icon;
        return (
          <aside key={bIdx} className={cn('mb-8 rounded-2xl border p-5 flex gap-4', style.cls)}>
            <Icon className={cn('w-6 h-6 shrink-0 mt-0.5', style.tone)} />
            <div className="min-w-0 space-y-1">
              <p className={cn('text-xs font-semibold uppercase tracking-wider', style.tone)}>{style.label}</p>
              {title && <p className="font-bold text-lg leading-snug">{parseInlineFormatting(title)}</p>}
              {body.map((l, i) => <p key={i} className="text-white/80 leading-relaxed">{parseInlineFormatting(l)}</p>)}
            </div>
          </aside>
        );
      }
      if (trimmed.startsWith('PHASE:')) {
        const parts = trimmed.replace('PHASE:', '').split('|');
        const title = parts[0]?.trim() || '', desc = parts[1]?.trim() || '', linkedId = parts[2]?.trim();
        const Icon = phaseIcon(title);
        return (
          <section key={bIdx} className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-7">
            <div className="flex items-center gap-4 mb-5"><div className="w-11 h-11 shrink-0 rounded-xl bg-primary/15 flex items-center justify-center"><Icon className="w-5 h-5 text-primary" /></div><h3 className="text-lg md:text-xl font-bold text-white leading-tight">{parseInlineFormatting(phaseTitle(title))}</h3></div>
            <div className="[&_p]:mb-3 [&_p:last-child]:mb-0">{desc.split('\n').map((l, lIdx) => renderLine(l, bIdx * 100 + lIdx))}</div>
            {linkedId && <Link href={`/learn/article/${linkedId}`}><Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 rounded-full px-6 font-semibold text-sm h-10 mt-4">Mehr dazu <ArrowRight className="ml-2 w-4 h-4" /></Button></Link>}
          </section>
        );
      }
      return <div key={bIdx} className="mb-2">{trimmed.split('\n').map((l, lIdx) => renderLine(l, bIdx * 100 + lIdx))}</div>;
    });
  };


  return <>{renderContent(content)}</>;
}
