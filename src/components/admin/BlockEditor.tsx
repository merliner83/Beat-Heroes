'use client';

import React, { useRef, useState } from 'react';
import {
  AlignLeft, ArrowDown, Download, ArrowUp, Bold, Gamepad2, Heading, ImagePlus, Layers, Lightbulb, Loader2, Minus, MoveVertical, Plug, Plus, Trash2, Video, Youtube,
} from 'lucide-react';
import { useFirebaseApp } from '@/firebase';
import type { LearnApp } from '@/lib/game/types';
import { Block, BlockType, TEMPLATES, TIP_KINDS, emptyBlock, serializeBlocks } from '@/lib/learn/blocks';
import { getYouTubeEmbedUrl } from '@/components/learn/LessonContent';
import { uploadImage } from '@/lib/upload';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const TYPES: { type: BlockType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'text', label: 'Text', icon: AlignLeft },
  { type: 'heading', label: 'Überschrift', icon: Heading },
  { type: 'image', label: 'Bild', icon: ImagePlus },
  { type: 'youtube', label: 'YouTube-Tutorial', icon: Youtube },
  { type: 'tip', label: 'Tipp-Box', icon: Lightbulb },
  { type: 'game', label: 'Übung', icon: Gamepad2 },
  { type: 'download', label: 'Link-Knopf', icon: Download },
  { type: 'plugin', label: 'Gratis-Plugin', icon: Plug },
  { type: 'divider', label: 'Trenner', icon: Minus },
  { type: 'video', label: 'Video (mp4)', icon: Video },
  { type: 'gap', label: 'Abstand', icon: MoveVertical },
  { type: 'phase', label: 'Phase', icon: Layers },
];
const META = Object.fromEntries(TYPES.map((t) => [t.type, t])) as Record<BlockType, (typeof TYPES)[number]>;

const selectCls = 'h-10 rounded-md bg-white/5 border border-white/15 px-3 text-sm';

function AddMenu({ onAdd, compact }: { onAdd: (t: BlockType) => void; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  if (!open) {
    return (
      <div className="flex justify-center -my-1 opacity-40 hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button type="button" onClick={() => setOpen(true)} aria-label="Baustein einfügen"
          className="w-7 h-7 rounded-full border border-white/20 bg-black flex items-center justify-center hover:border-primary hover:text-primary">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5 justify-center p-2 rounded-xl border border-dashed border-white/15">
      {TYPES.map(({ type, label, icon: Icon }) => (
        <button key={type} type="button" onClick={() => { onAdd(type); if (compact) setOpen(false); }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border border-white/15 text-white/75 hover:text-white hover:border-primary">
          <Icon className="w-3.5 h-3.5" /> {label}
        </button>
      ))}
      {compact && <button type="button" onClick={() => setOpen(false)} className="text-xs text-white/60 px-2">Abbrechen</button>}
    </div>
  );
}

/** Textfeld mit Fett-Knopf (setzt **…** um die Auswahl). */
function RichText({ value, onChange, rows = 4, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const bold = () => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = value.slice(a, b) || 'fett';
    onChange(`${value.slice(0, a)}**${sel}**${value.slice(b)}`);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + 2, a + 2 + sel.length); });
  };
  return (
    <div className="relative">
      <Textarea ref={ref} value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="pr-10 leading-relaxed" />
      <button type="button" onClick={bold} title="Fett (**…**)" className="absolute top-2 right-2 w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center">
        <Bold className="w-4 h-4" />
      </button>
    </div>
  );
}

function BlockFields({ block, update, apps, folder }: {
  block: Block;
  update: (b: Block) => void;
  apps: LearnApp[];
  folder: string;
}) {
  const app = useFirebaseApp();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Block>) => update({ ...block, ...patch } as Block);

  switch (block.type) {
    case 'heading':
      return (
        <div className="flex gap-2">
          <select className={selectCls} value={block.level} onChange={(e) => set({ level: Number(e.target.value) as 1 | 2 | 3 })}>
            <option value={1}>Titel</option>
            <option value={2}>Zwischentitel</option>
            <option value={3}>Label</option>
          </select>
          <Input value={block.text} onChange={(e) => set({ text: e.target.value })} placeholder="Überschrift"
            className={cn(block.level === 1 && 'text-lg font-bold', block.level === 3 && 'uppercase text-xs tracking-wider')} />
        </div>
      );
    case 'text':
      return <RichText value={block.text} onChange={(text) => set({ text })} rows={Math.min(14, Math.max(3, block.text.split('\n').length + 1))} placeholder="Text. Jede Zeile wird ein Absatz, **fett** mit dem B-Knopf, [[Fachbegriff]] hervorgehoben." />;
    case 'divider':
      return <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent my-2" />;
    case 'gap':
      return <label className="flex items-center gap-2 text-sm text-white/70">Höhe <Input type="number" min={4} max={200} value={block.size} onChange={(e) => set({ size: Number(e.target.value) || 20 })} className="w-24" /> px</label>;
    case 'image': {
      const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !app) return;
        setBusy(true);
        try {
          set({ url: await uploadImage(app, `articles/${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`, file, 10) });
        } catch (err) {
          toast({ variant: 'destructive', title: 'Upload fehlgeschlagen', description: err instanceof Error ? err.message : undefined });
        } finally {
          setBusy(false);
        }
      };
      return (
        <div className="space-y-2">
          {block.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.url} alt="" className="max-h-56 rounded-xl border border-white/10" />
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="w-full h-28 rounded-xl border border-dashed border-white/20 flex items-center justify-center gap-2 text-sm text-white/70 hover:border-primary">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />} Bild hochladen
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
          <div className="flex gap-2">
            <Input value={block.caption} onChange={(e) => set({ caption: e.target.value })} placeholder="Bildunterschrift (optional)" />
            {block.url && <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-white/70 hover:text-white shrink-0 px-2">{busy ? '…' : 'Ersetzen'}</button>}
          </div>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={!!block.small} onChange={(e) => set({ small: e.target.checked })} className="w-4 h-4 accent-[hsl(var(--primary))]" />
            Klein zeigen (z.B. für Plugin-Fenster)
          </label>
        </div>
      );
    }
    case 'video':
      return <Input value={block.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…/video.mp4 (Hochformat-Clip)" />;
    case 'youtube': {
      const id = getYouTubeEmbedUrl(block.url)?.split('/embed/')[1];
      return (
        <div className="flex gap-3">
          <div className="w-36 aspect-video rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {id ? <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" /> : <Youtube className="w-6 h-6 text-white/30" />}
          </div>
          <div className="flex-1 space-y-2">
            <Input value={block.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" />
            {block.url && !id && <p className="text-xs text-warning">Link nicht erkannt</p>}
            <Input value={block.title} onChange={(e) => set({ title: e.target.value })} placeholder="Titel der Karte" />
            <Input value={block.description} onChange={(e) => set({ description: e.target.value })} placeholder="Worauf sollen sie achten? (optional)" />
            <label className="flex items-center gap-2 text-sm text-white/75">
              <input type="checkbox" checked={!!block.small} onChange={(e) => set({ small: e.target.checked })} className="w-4 h-4 accent-[hsl(var(--primary))]" />
              Klein als «Inspiration» zeigen (weiterführend, nicht Kern der Lektion)
            </label>
          </div>
        </div>
      );
    }
    case 'download':
      return (
        <div className="flex flex-col md:flex-row gap-2">
          <Input value={block.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://… (Download, Website, Plugin)" />
          <Input value={block.label} onChange={(e) => set({ label: e.target.value })} placeholder="Beschriftung, z.B. «MJUC gratis laden»" className="md:w-72" />
        </div>
      );
    case 'plugin':
      return (
        <div className="flex flex-col md:flex-row gap-2">
          <Input value={block.lessonId} onChange={(e) => set({ lessonId: e.target.value })} placeholder="Lektion-ID, z.B. art-plugin-flayr-tune" className="md:w-72" />
          <Input value={block.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name, z.B. Flayr Tune" className="md:w-48" />
          <Input value={block.text} onChange={(e) => set({ text: e.target.value })} placeholder="Wofür? z.B. «Gratis-Ersatz für Auto-Tune»" />
        </div>
      );
    case 'game':
      return (
        <div className="flex flex-col md:flex-row gap-2">
          <select className={cn(selectCls, 'md:w-72')} value={block.appId}
            onChange={(e) => set({ appId: e.target.value, label: block.label || apps.find((a) => a.id === e.target.value)?.name || '' })}>
            <option value="">– Übung wählen –</option>
            {[...apps].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <Input value={block.label} onChange={(e) => set({ label: e.target.value })} placeholder="Beschriftung, z.B. «Jetzt mitklopfen»" />
        </div>
      );
    case 'tip':
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {TIP_KINDS.map((k) => (
              <button key={k.id} type="button" onClick={() => set({ kind: k.id })}
                className={cn('h-7 px-3 rounded-full text-xs font-medium border', block.kind === k.id ? 'bg-primary border-primary text-white' : 'border-white/15 text-white/70')}>
                {k.label}
              </button>
            ))}
          </div>
          <Input value={block.title} onChange={(e) => set({ title: e.target.value })} placeholder="Titel der Box" />
          <RichText value={block.text} onChange={(text) => set({ text })} rows={3} placeholder="Text der Box" />
        </div>
      );
    case 'phase':
      return (
        <div className="space-y-2">
          <Input value={block.title} onChange={(e) => set({ title: e.target.value })} placeholder="Phase, z.B. COMPOSING: Idee finden" />
          <RichText value={block.text} onChange={(text) => set({ text })} rows={3} placeholder="Beschreibung" />
          <Input value={block.lessonId} onChange={(e) => set({ lessonId: e.target.value })} placeholder="Weiterführende Lektion (ID, optional)" />
        </div>
      );
  }
}

/**
 * Baustein-Editor: verwaltet Blöcke und meldet den daraus erzeugten
 * Lektionstext. Der Text wird nur beim Mounten gelesen (für Neuladen key ändern).
 */
export function BlockEditor({ initial, onChange, apps, folder }: {
  initial: Block[];
  onChange: (content: string) => void;
  apps: LearnApp[];
  folder: string;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initial);

  const commit = (next: Block[]) => {
    setBlocks(next);
    onChange(serializeBlocks(next));
  };
  const insertAt = (i: number, type: BlockType) => commit([...blocks.slice(0, i), emptyBlock(type), ...blocks.slice(i)]);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  if (blocks.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/70">Mit einer Vorlage starten oder leer beginnen:</p>
        <div className="grid gap-3 md:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => commit(t.build())}
              className="text-left p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:border-primary transition-colors">
              <p className="font-bold">{t.title}</p>
              <p className="text-xs text-white/60 mt-1">{t.description}</p>
            </button>
          ))}
        </div>
        <AddMenu onAdd={(t) => insertAt(0, t)} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const { label, icon: Icon } = META[b.type];
        return (
          <React.Fragment key={b.id}>
            <AddMenu compact onAdd={(t) => insertAt(i, t)} />
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Icon className="w-4 h-4" /> <span className="font-medium">{label}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-white/10 disabled:opacity-30" aria-label="Nach oben"><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="p-1 rounded hover:bg-white/10 disabled:opacity-30" aria-label="Nach unten"><ArrowDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => commit(blocks.filter((x) => x.id !== b.id))} className="p-1 rounded hover:bg-white/10 hover:text-destructive" aria-label="Löschen"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <BlockFields block={b} apps={apps} folder={folder} update={(nb) => commit(blocks.map((x) => (x.id === b.id ? nb : x)))} />
            </div>
          </React.Fragment>
        );
      })}
      <AddMenu onAdd={(t) => insertAt(blocks.length, t)} />
    </div>
  );
}
