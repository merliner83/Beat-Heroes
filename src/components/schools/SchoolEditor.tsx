'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ExternalLink, ImagePlus, Loader2 } from 'lucide-react';
import { useFirebaseApp, useFirestore } from '@/firebase';
import { ACCENT_COLORS, School } from '@/lib/game/types';
import { uploadImage } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SchoolLogo } from './SchoolBadge';

/** Öffentliches Schulprofil bearbeiten (Super-Admin, Schul-Admin der Schule). */
export function SchoolEditor({ school }: { school: School }) {
  const db = useFirestore();
  const app = useFirebaseApp();
  const { toast } = useToast();
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: school.name ?? '',
    description: school.description ?? '',
    website: school.website ?? '',
    location: school.location ?? '',
    accentColor: school.accentColor ?? null as string | null,
    logoUrl: school.logoUrl ?? null as string | null,
    bannerUrl: school.bannerUrl ?? null as string | null,
  });
  const [busy, setBusy] = useState<string | null>(null);

  const upload = async (kind: 'logo' | 'banner', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !app) return;
    setBusy(kind);
    try {
      const url = await uploadImage(app, `schools/${school.id}/${kind}-${Date.now()}`, file, 5);
      setForm((f) => ({ ...f, [kind === 'logo' ? 'logoUrl' : 'bannerUrl']: url }));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Upload fehlgeschlagen', description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!db) return;
    if (form.website && !/^https:\/\//i.test(form.website)) {
      toast({ variant: 'destructive', title: 'Website muss mit https:// beginnen' });
      return;
    }
    setBusy('save');
    try {
      await updateDoc(doc(db, 'schools', school.id), {
        name: form.name.trim().slice(0, 80) || school.name,
        description: form.description.slice(0, 2000),
        website: form.website.trim(),
        location: form.location.trim().slice(0, 80),
        accentColor: form.accentColor,
        logoUrl: form.logoUrl,
        bannerUrl: form.bannerUrl,
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'Schulprofil gespeichert' });
    } catch {
      toast({ variant: 'destructive', title: 'Speichern fehlgeschlagen' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => bannerRef.current?.click()}
        className="relative w-full h-28 rounded-xl overflow-hidden border border-white/10 bg-white/5 group">
        {form.bannerUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={form.bannerUrl} alt="" className="w-full h-full object-cover" />
          : <span className="text-sm text-white/60">Titelbild hochladen (breit, z.B. 1600×500)</span>}
        <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          {busy === 'banner' ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
        </span>
      </button>
      <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload('banner', e)} />

      <div className="flex items-center gap-4">
        <button type="button" onClick={() => logoRef.current?.click()} className="relative group" aria-label="Logo hochladen">
          <SchoolLogo school={{ name: form.name, logoUrl: form.logoUrl }} size={72} />
          <span className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            {busy === 'logo' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
          </span>
        </button>
        <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload('logo', e)} />
        <div className="text-xs text-white/60 space-y-1">
          <p>Logo: quadratisch oder quer, am besten PNG/SVG mit transparentem Hintergrund.</p>
          {form.logoUrl && <button type="button" className="text-white/70 hover:text-white" onClick={() => setForm({ ...form, logoUrl: null })}>Logo entfernen</button>}
          {form.bannerUrl && <button type="button" className="ml-3 text-white/70 hover:text-white" onClick={() => setForm({ ...form, bannerUrl: null })}>Titelbild entfernen</button>}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1 text-xs text-white/60">Name
          <Input value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block space-y-1 text-xs text-white/60">Ort
          <Input value={form.location} maxLength={80} placeholder="z.B. Langnau i.E." onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </label>
        <label className="block space-y-1 text-xs text-white/60 md:col-span-2">Website
          <Input value={form.website} placeholder="https://…" onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </label>
        <label className="block space-y-1 text-xs text-white/60 md:col-span-2">Über die Schule
          <Textarea value={form.description} maxLength={2000} rows={4} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-white/60">Akzentfarbe</p>
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map((c) => (
            <button key={c.hex} type="button" title={c.name} onClick={() => setForm({ ...form, accentColor: c.hex })}
              className={cn('w-8 h-8 rounded-full border-2 transition-transform', form.accentColor === c.hex ? 'border-white scale-110' : 'border-transparent')}
              style={{ background: c.hex }} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={!!busy}>{busy === 'save' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Speichern</Button>
        <Link href={`/schools/${school.id}`} target="_blank"><Button variant="outline">Öffentliche Seite <ExternalLink className="w-4 h-4 ml-2" /></Button></Link>
      </div>
    </div>
  );
}
