'use client';

import React, { useMemo, useState } from 'react';
import { collection, deleteDoc, doc, query, setDoc } from 'firebase/firestore';
import { Plus, Route, Trash2, Award } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Article, Course, LearningPath } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type Draft = Omit<LearningPath, 'id'> & { id?: string };

const EMPTY: Draft = { title: '', description: '', requiredLessonIds: [], minScore: 80, official: false, credits: 0, order: 100, published: true };

function slugify(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

function PathForm({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>(initial);
  const coursesQ = useMemoFirebase(() => (db ? query(collection(db, 'courses')) : null), [db]);
  const articlesQ = useMemoFirebase(() => (db ? query(collection(db, 'articles')) : null), [db]);
  const { data: courses } = useCollection<Course>(coursesQ);
  const { data: articles } = useCollection<Article>(articlesQ);

  const groups = useMemo(() => {
    const out: { key: string; label: string; lessons: Article[] }[] = [];
    [...(courses ?? [])].sort((a, b) => a.order - b.order).forEach((c) => {
      [...c.chapters].sort((a, b) => a.order - b.order).forEach((ch) => {
        const lessons = (articles ?? [])
          .filter((a) => (a.courseId ?? 'producing') === c.id && (a.chapterId ?? a.categoryId) === ch.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        if (lessons.length) out.push({ key: `${c.id}/${ch.id}`, label: `${c.title} · ${ch.title}`, lessons });
      });
    });
    return out;
  }, [courses, articles]);

  const toggle = (id: string, on: boolean) =>
    setDraft((d) => ({ ...d, requiredLessonIds: on ? [...d.requiredLessonIds, id] : d.requiredLessonIds.filter((x) => x !== id) }));

  const save = async () => {
    if (!db || !draft.title.trim()) return;
    const id = draft.id ?? slugify(draft.title);
    if (!id) return;
    const { id: _ignored, ...data } = draft;
    try {
      await setDoc(doc(db, 'learningPaths', id), {
        ...data,
        title: draft.title.trim(),
        minScore: Math.max(0, Math.min(100, Number(draft.minScore) || 0)),
        credits: Math.max(0, Math.min(10000, Number(draft.credits) || 0)),
        order: Number(draft.order) || 0,
      });
      toast({ title: 'Lernpfad gespeichert' });
      onClose();
    } catch {
      toast({ variant: 'destructive', title: 'Speichern fehlgeschlagen' });
    }
  };

  return (
    <div className="space-y-4">
      <Input placeholder="Titel, z.B. «Talentförderung Producing – Stufe 1»" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      <Textarea placeholder="Beschreibung für die Schüler:innen" rows={3} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      <div className="grid grid-cols-3 gap-3">
        <label className="text-xs text-white/50 space-y-1">Mindest-Quizscore %<Input type="number" min={0} max={100} value={draft.minScore} onChange={(e) => setDraft({ ...draft, minScore: Number(e.target.value) })} /></label>
        <label className="text-xs text-white/50 space-y-1">Credits bei Abschluss<Input type="number" min={0} value={draft.credits ?? 0} onChange={(e) => setDraft({ ...draft, credits: Number(e.target.value) })} /></label>
        <label className="text-xs text-white/50 space-y-1">Reihenfolge<Input type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })} /></label>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm"><Switch checked={!!draft.official} onCheckedChange={(v) => setDraft({ ...draft, official: v })} /> Offiziell (z.B. Talentförderung)</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={draft.published !== false} onCheckedChange={(v) => setDraft({ ...draft, published: v })} /> Für Schüler:innen sichtbar</label>
      </div>
      <div>
        <p className="text-xs text-white/50 mb-2">Pflicht-Lektionen ({draft.requiredLessonIds.length})</p>
        <div className="max-h-72 overflow-y-auto space-y-4 p-3 rounded-xl bg-white/[0.03] border border-white/10">
          {groups.map((g) => (
            <div key={g.key} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{g.label}</p>
              {g.lessons.map((l) => (
                <label key={l.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={draft.requiredLessonIds.includes(l.id)} onCheckedChange={(c) => toggle(l.id, !!c)} />
                  {l.title}
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
      <Button onClick={save} disabled={!draft.title.trim() || draft.requiredLessonIds.length === 0} className="w-full">Speichern</Button>
    </div>
  );
}

export function PathsEditor() {
  const db = useFirestore();
  const { toast } = useToast();
  const pathsQ = useMemoFirebase(() => (db ? query(collection(db, 'learningPaths')) : null), [db]);
  const { data: paths } = useCollection<LearningPath>(pathsQ);
  const [editing, setEditing] = useState<Draft | null>(null);

  const remove = async (p: LearningPath) => {
    if (!db || !confirm(`Lernpfad «${p.title}» löschen? Bereits erreichte Abschlüsse bleiben erhalten.`)) return;
    try { await deleteDoc(doc(db, 'learningPaths', p.id)); } catch { toast({ variant: 'destructive', title: 'Löschen fehlgeschlagen' }); }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Route className="w-5 h-5 text-primary" /><h2 className="text-base font-bold text-white/90">Lernpfade</h2></div>
        <Button size="sm" onClick={() => setEditing({ ...EMPTY })}><Plus className="w-4 h-4 mr-1" /> Lernpfad</Button>
      </div>
      <p className="text-sm text-white/60">Vorlagen aus Pflicht-Lektionen, z.B. für die Talentförderung. Der Abschluss wird serverseitig geprüft und vermerkt.</p>
      <div className="grid gap-2 md:grid-cols-2">
        {[...(paths ?? [])].sort((a, b) => a.order - b.order).map((p) => (
          <div key={p.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-3">
            {p.official ? <Award className="w-5 h-5 text-credit shrink-0" /> : <Route className="w-5 h-5 text-white/60 shrink-0" />}
            <button className="flex-1 min-w-0 text-left" onClick={() => setEditing({ ...p })}>
              <p className="font-bold truncate">{p.title}</p>
              <p className="text-xs text-white/60">{p.requiredLessonIds.length} Lektionen · ab {p.minScore}%{p.published === false ? ' · versteckt' : ''}</p>
            </button>
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(p)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
        {paths?.length === 0 && <p className="text-sm text-white/60">Noch keine Lernpfade.</p>}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? 'Lernpfad bearbeiten' : 'Neuer Lernpfad'}</DialogTitle></DialogHeader>
          {editing && <PathForm initial={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
