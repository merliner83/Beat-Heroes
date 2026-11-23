'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { Camera, CheckCircle2, Clock, ExternalLink, Eye, Loader2, MessageSquareWarning, Plus, Send, Trash2, UserRound } from 'lucide-react';
import { useDoc, useFirebaseApp, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import {
  ARTIST_GENRES, ARTIST_ROLES, HANDLE_PATTERN, ProfileContent, ProfileDraft, PublicProfile, toEmbed, toHandle,
} from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ProfileShowcase } from './ProfileShowcase';

const EMPTY: ProfileContent = { artistName: '', handle: '', bio: '', avatarUrl: null, roles: [], genres: [], embeds: [], links: [], openForCollab: false };

function Chips({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn('px-3 h-8 rounded-full text-sm font-bold border transition-colors', on ? 'bg-primary border-primary text-white' : 'border-white/15 text-white/60 hover:text-white')}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function StatusLine({ draft }: { draft: ProfileDraft | null }) {
  if (!draft) return null;
  const map = {
    draft: { icon: Clock, text: 'Entwurf – noch nicht eingereicht', cls: 'text-white/60' },
    submitted: { icon: Send, text: 'Eingereicht – wartet auf Freigabe durch deine Lehrperson', cls: 'text-primary' },
    changes_requested: { icon: MessageSquareWarning, text: 'Bitte überarbeiten', cls: 'text-[#FF9100]' },
    approved: { icon: CheckCircle2, text: 'Freigegeben und öffentlich', cls: 'text-[#00E676]' },
  } as const;
  const s = map[draft.status];
  const Icon = s.icon;
  return (
    <div className="space-y-2">
      <p className={cn('flex items-center gap-2 font-bold text-sm', s.cls)}><Icon className="w-4 h-4" /> {s.text}</p>
      {draft.teacherNote && draft.status !== 'submitted' && (
        <p className="text-sm bg-white/5 rounded-xl p-3 whitespace-pre-line text-white/70">{draft.teacherNote}</p>
      )}
    </div>
  );
}

export function ProfileEditor() {
  const db = useFirestore();
  const app = useFirebaseApp();
  const { user, profile } = useUser();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const draftRef = useMemoFirebase(() => (db && user ? doc(db, 'profileDrafts', user.uid) : null), [db, user]);
  const publicRef = useMemoFirebase(() => (db && user ? doc(db, 'profiles', user.uid) : null), [db, user]);
  const { data: draft, isLoading } = useDoc<ProfileDraft>(draftRef);
  const { data: published } = useDoc<PublicProfile>(publicRef);

  const [form, setForm] = useState<ProfileContent>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [newEmbed, setNewEmbed] = useState('');
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (loaded || isLoading || !user) return;
    if (draft) {
      setForm({ ...EMPTY, ...draft });
    } else {
      const name = profile?.displayName || user.displayName || '';
      setForm({ ...EMPTY, artistName: name, handle: toHandle(name), avatarUrl: user.photoURL ?? null });
    }
    setLoaded(true);
  }, [draft, isLoading, loaded, user, profile?.displayName]);

  if (!user) return <p className="text-white/50">Melde dich an, um dein Profil zu gestalten.</p>;
  if (!loaded) return <div className="h-40 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const set = <K extends keyof ProfileContent>(key: K, value: ProfileContent[K]) => setForm((f) => ({ ...f, [key]: value }));
  const handleOk = HANDLE_PATTERN.test(form.handle);

  const addEmbed = () => {
    const url = newEmbed.trim();
    if (!toEmbed(url)) {
      toast({ variant: 'destructive', title: 'Link nicht erkannt', description: 'Unterstützt: Spotify, SoundCloud, YouTube.' });
      return;
    }
    set('embeds', [...form.embeds, url].slice(0, 8));
    setNewEmbed('');
  };

  const addLink = () => {
    const url = newLink.url.trim();
    if (!/^https:\/\//i.test(url)) {
      toast({ variant: 'destructive', title: 'Link muss mit https:// beginnen' });
      return;
    }
    set('links', [...form.links, { label: newLink.label.trim().slice(0, 40), url }].slice(0, 8));
    setNewLink({ label: '', url: '' });
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !app) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Bild zu gross', description: 'Maximal 5 MB, nur Bilder.' });
      return;
    }
    setBusy(true);
    try {
      const r = ref(getStorage(app), `profiles/${user.uid}/avatar-${Date.now()}`);
      await uploadBytes(r, file, { contentType: file.type });
      set('avatarUrl', await getDownloadURL(r));
    } catch (err) {
      console.warn(err);
      toast({ variant: 'destructive', title: 'Upload fehlgeschlagen' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (submit: boolean) => {
    if (!db) return;
    if (!form.artistName.trim() || !handleOk) {
      toast({ variant: 'destructive', title: 'Künstlername und Profil-Link prüfen' });
      return;
    }
    setBusy(true);
    try {
      const taken = await getDoc(doc(db, 'handles', form.handle));
      if (taken.exists() && taken.data().uid !== user.uid) {
        toast({ variant: 'destructive', title: 'Profil-Link vergeben', description: `/artists/${form.handle} gehört schon jemandem.` });
        return;
      }
      const data: Record<string, unknown> = {
        uid: user.uid,
        schoolId: profile?.schoolId ?? null,
        status: submit ? 'submitted' : 'draft',
        artistName: form.artistName.trim().slice(0, 60),
        handle: form.handle,
        bio: (form.bio ?? '').slice(0, 1500),
        avatarUrl: form.avatarUrl ?? null,
        roles: form.roles,
        genres: form.genres,
        embeds: form.embeds,
        links: form.links,
        openForCollab: !!form.openForCollab,
        updatedAt: serverTimestamp(),
      };
      if (submit) data.submittedAt = serverTimestamp();
      await setDoc(doc(db, 'profileDrafts', user.uid), data, { merge: true });
      toast({ title: submit ? 'Eingereicht' : 'Gespeichert', description: submit ? 'Deine Lehrperson schaut es sich an.' : 'Entwurf gespeichert.' });
    } catch (err) {
      console.warn(err);
      toast({ variant: 'destructive', title: 'Speichern fehlgeschlagen' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><UserRound className="w-5 h-5 text-primary" /><h2 className="text-xs font-black uppercase tracking-[0.4em] text-white/60">Mein Artist-Profil</h2></div>
        {published && (
          <Link href={`/artists/${published.handle}`} className="text-sm text-primary flex items-center gap-1 hover:underline">
            Öffentliche Seite <ExternalLink className="w-4 h-4" />
          </Link>
        )}
      </div>

      <StatusLine draft={draft} />
      {!profile?.schoolId && (
        <p className="text-sm text-[#FF9100]">Tritt zuerst auf der Startseite einer Klasse bei, damit deine Lehrperson dein Profil freigeben kann.</p>
      )}

      <div className="grid gap-6 md:grid-cols-[160px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative w-36 h-36 rounded-full overflow-hidden border-4 border-white/10 bg-white/5 group">
            {form.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={form.avatarUrl} alt="Profilbild" className="w-full h-full object-cover" />
              : <span className="text-5xl font-black italic text-gradient">{(form.artistName || '?').charAt(0).toUpperCase()}</span>}
            <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera className="w-7 h-7" /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          {form.avatarUrl && <button type="button" onClick={() => set('avatarUrl', null)} className="text-xs text-white/40 hover:text-white">Bild entfernen</button>}
        </div>

        <div className="space-y-4">
          <label className="block space-y-1 text-xs text-white/50">Künstlername
            <Input value={form.artistName} maxLength={60} onChange={(e) => {
              const v = e.target.value;
              setForm((f) => ({ ...f, artistName: v, handle: f.handle && f.handle !== toHandle(f.artistName) ? f.handle : toHandle(v) }));
            }} />
          </label>
          <label className="block space-y-1 text-xs text-white/50">Profil-Link
            <div className="flex items-center gap-1">
              <span className="text-sm text-white/40 shrink-0">/artists/</span>
              <Input value={form.handle} maxLength={30} onChange={(e) => set('handle', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
            </div>
            {!handleOk && form.handle && <span className="text-[#FF9100]">3–30 Zeichen: a–z, 0–9, Bindestrich (nicht am Anfang/Ende)</span>}
          </label>
          <label className="block space-y-1 text-xs text-white/50">Über mich
            <Textarea value={form.bio ?? ''} maxLength={1500} rows={4} onChange={(e) => set('bio', e.target.value)} placeholder="Was machst du musikalisch? Wer inspiriert dich?" />
          </label>
        </div>
      </div>

      <div className="space-y-2"><p className="text-xs text-white/50">Was machst du?</p><Chips options={ARTIST_ROLES} value={form.roles} onChange={(v) => set('roles', v)} /></div>
      <div className="space-y-2"><p className="text-xs text-white/50">Genres</p><Chips options={ARTIST_GENRES} value={form.genres} onChange={(v) => set('genres', v)} /></div>
      <label className="flex items-center gap-3 text-sm"><Switch checked={!!form.openForCollab} onCheckedChange={(v) => set('openForCollab', v)} /> Offen für Kollabos</label>

      <div className="space-y-2">
        <p className="text-xs text-white/50">Tracks & Videos (Spotify, SoundCloud, YouTube)</p>
        {form.embeds.map((url) => (
          <div key={url} className="flex items-center gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
            <span className="flex-1 truncate">{url}</span>
            <button type="button" onClick={() => set('embeds', form.embeds.filter((x) => x !== url))}><Trash2 className="w-4 h-4 text-white/40 hover:text-destructive" /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input value={newEmbed} onChange={(e) => setNewEmbed(e.target.value)} placeholder="https://open.spotify.com/track/…" onKeyDown={(e) => e.key === 'Enter' && addEmbed()} />
          <Button type="button" variant="outline" onClick={addEmbed} disabled={!newEmbed.trim()}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-white/50">Links (Instagram, TikTok, Bandcamp …)</p>
        {form.links.map((l) => (
          <div key={l.url} className="flex items-center gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
            <span className="font-bold shrink-0">{l.label || 'Link'}</span><span className="flex-1 truncate text-white/50">{l.url}</span>
            <button type="button" onClick={() => set('links', form.links.filter((x) => x.url !== l.url))}><Trash2 className="w-4 h-4 text-white/40 hover:text-destructive" /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input className="w-32 md:w-40" value={newLink.label} onChange={(e) => setNewLink({ ...newLink, label: e.target.value })} placeholder="Instagram" />
          <Input value={newLink.url} onChange={(e) => setNewLink({ ...newLink, url: e.target.value })} placeholder="https://…" onKeyDown={(e) => e.key === 'Enter' && addLink()} />
          <Button type="button" variant="outline" onClick={addLink} disabled={!newLink.url.trim()}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button variant="outline" onClick={() => setPreview(true)}><Eye className="w-4 h-4 mr-2" /> Vorschau</Button>
        <Button variant="outline" onClick={() => save(false)} disabled={busy}>Entwurf speichern</Button>
        <Button onClick={() => save(true)} disabled={busy || !handleOk || !form.artistName.trim()}><Send className="w-4 h-4 mr-2" /> Zur Freigabe einreichen</Button>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="bg-[#050505] border-white/10 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vorschau</DialogTitle></DialogHeader>
          <ProfileShowcase profile={form} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
