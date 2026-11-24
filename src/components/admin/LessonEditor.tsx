'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, deleteDoc, doc, getDoc, query, setDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { ArrowLeft, Eye, Heading1, Heading2, ImagePlus, Loader2, Minus, Plus, Save, Trash2, Video } from 'lucide-react';
import { useCollection, useFirebaseApp, useFirestore, useMemoFirebase } from '@/firebase';
import { Article, Course, LearnApp, LearnSubCat, QuizQuestion } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { LessonContent } from '@/components/learn/LessonContent';
import { BlockEditor } from './BlockEditor';
import { parseBlocks } from '@/lib/learn/blocks';

type Form = {
  title: string;
  courseId: string;
  chapterId: string;
  subCategoryId: string;
  order: number;
  maxPoints: number;
  hidden: boolean;
  content: string;
  youtubeUrls: string[];
};

const EMPTY_QUESTION: QuizQuestion = { question: '', options: ['', '', '', ''], correctOption: 0 };

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

const selectCls = 'h-10 w-full rounded-md bg-white/5 border border-white/15 px-3 text-sm';

export function LessonEditor({ lessonId, defaults }: { lessonId: string | null; defaults?: { courseId?: string; chapterId?: string } }) {
  const db = useFirestore();
  const app = useFirebaseApp();
  const router = useRouter();
  const { toast } = useToast();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const coursesQ = useMemoFirebase(() => (db ? query(collection(db, 'courses')) : null), [db]);
  const subCatsQ = useMemoFirebase(() => (db ? query(collection(db, 'learnSubCats')) : null), [db]);
  const appsQ = useMemoFirebase(() => (db ? query(collection(db, 'learnApps')) : null), [db]);
  const { data: courses } = useCollection<Course>(coursesQ);
  const { data: subCats } = useCollection<LearnSubCat>(subCatsQ);
  const { data: apps } = useCollection<LearnApp>(appsQ);

  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [newYoutube, setNewYoutube] = useState('');
  const [preview, setPreview] = useState(false);
  const [mode, setMode] = useState<'blocks' | 'text'>('blocks');
  const [blocksKey, setBlocksKey] = useState(0);
  const initialBlocks = useMemo(() => (form ? parseBlocks(form.content) : []),
    // Nur beim (Neu-)Mounten des Baustein-Editors lesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocksKey, !!form]);
  const [busy, setBusy] = useState(false);

  // Lektion (inkl. Quiz und Lösungen) laden
  useEffect(() => {
    if (!db || form) return;
    (async () => {
      if (!lessonId) {
        setForm({ title: '', courseId: defaults?.courseId ?? 'producing', chapterId: defaults?.chapterId ?? '', subCategoryId: '', order: 100, maxPoints: 250, hidden: false, content: '', youtubeUrls: [] });
        return;
      }
      const [a, q, k] = await Promise.all([
        getDoc(doc(db, 'articles', lessonId)), getDoc(doc(db, 'learnQuizzes', lessonId)), getDoc(doc(db, 'learnQuizKeys', lessonId)),
      ]);
      const data = (a.data() ?? {}) as Partial<Article>;
      setForm({
        title: data.title ?? '',
        courseId: data.courseId ?? 'producing',
        chapterId: data.chapterId ?? data.categoryId ?? '',
        subCategoryId: data.subCategoryId ?? '',
        order: data.order ?? 100,
        maxPoints: data.maxPoints ?? 250,
        hidden: data.minRole === 'teacher' || data.minRole === 'superAdmin',
        content: data.content ?? '',
        youtubeUrls: data.youtubeUrls ?? [],
      });
      const answers: (number | null)[] = k.data()?.answers ?? [];
      setQuestions(((q.data()?.questions ?? []) as Omit<QuizQuestion, 'correctOption'>[]).map((qq, i) => ({ ...qq, correctOption: answers[i] ?? 0 })));
    })().catch((err) => {
      console.warn(err);
      toast({ variant: 'destructive', title: 'Laden fehlgeschlagen' });
    });
  }, [db, lessonId, form, defaults, toast]);

  const course = courses?.find((c) => c.id === form?.courseId);
  const chapters = useMemo(() => [...(course?.chapters ?? [])].sort((a, b) => a.order - b.order), [course]);
  const chapterSubCats = (subCats ?? []).filter((s) => s.categoryId === form?.chapterId);

  if (!form) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const insert = (snippet: string) => {
    const el = textRef.current;
    const pos = el?.selectionStart ?? form.content.length;
    const before = form.content.slice(0, pos);
    const after = form.content.slice(pos);
    const pad = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    set('content', `${before}${pad}${snippet}\n\n${after}`);
    requestAnimationFrame(() => el?.focus());
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !app) return;
    setBusy(true);
    try {
      const folder = lessonId ?? (slugify(form.title) || 'neu');
      const r = ref(getStorage(app), `articles/${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
      await uploadBytes(r, file, { contentType: file.type });
      insert(`IMAGE: ${await getDownloadURL(r)}`);
    } catch (err) {
      console.warn(err);
      toast({ variant: 'destructive', title: 'Upload fehlgeschlagen' });
    } finally {
      setBusy(false);
      if (imageRef.current) imageRef.current.value = '';
    }
  };

  const save = async () => {
    if (!db || !form.title.trim() || !form.chapterId) {
      toast({ variant: 'destructive', title: 'Titel und Kapitel sind nötig' });
      return;
    }
    const id = lessonId ?? `art-${slugify(form.title)}`;
    if (!lessonId) {
      const exists = await getDoc(doc(db, 'articles', id));
      if (exists.exists()) {
        toast({ variant: 'destructive', title: 'Titel schon vergeben', description: 'Bitte einen anderen Titel wählen.' });
        return;
      }
    }
    const validQuestions = questions.filter((q) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2);
    setBusy(true);
    try {
      const data: Record<string, unknown> = {
        title: form.title.trim(),
        courseId: form.courseId,
        chapterId: form.chapterId,
        categoryId: form.chapterId,
        subCategoryId: form.subCategoryId || null,
        order: Number(form.order) || 0,
        maxPoints: Math.max(0, Math.min(2000, Number(form.maxPoints) || 0)),
        content: form.content,
        youtubeUrls: form.youtubeUrls,
        minRole: form.hidden ? 'teacher' : null,
      };
      await setDoc(doc(db, 'articles', id), data, { merge: true });
      if (validQuestions.length) {
        const cleaned = validQuestions.map((q) => {
          const options = q.options.map((o) => o.trim()).filter(Boolean);
          return { question: q.question.trim(), options, correctOption: Math.min(q.correctOption, options.length - 1) };
        });
        await setDoc(doc(db, 'learnQuizzes', id), { articleId: id, questions: cleaned.map(({ correctOption, ...q }) => q) });
        await setDoc(doc(db, 'learnQuizKeys', id), { answers: cleaned.map((q) => q.correctOption) });
      } else {
        await Promise.all([deleteDoc(doc(db, 'learnQuizzes', id)), deleteDoc(doc(db, 'learnQuizKeys', id))]);
      }
      toast({ title: 'Lektion gespeichert' });
      if (!lessonId) router.replace(`/admin/articles/${id}`);
    } catch (err) {
      console.warn(err);
      toast({ variant: 'destructive', title: 'Speichern fehlgeschlagen' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!db || !lessonId || !confirm(`Lektion «${form.title}» endgültig löschen? Fortschritt der Schüler:innen bleibt gespeichert, die Lektion ist aber weg.`)) return;
    await Promise.all([
      deleteDoc(doc(db, 'articles', lessonId)), deleteDoc(doc(db, 'learnQuizzes', lessonId)), deleteDoc(doc(db, 'learnQuizKeys', lessonId)),
    ]);
    toast({ title: 'Lektion gelöscht' });
    router.replace('/admin');
  };

  const updateQuestion = (i: number, q: QuizQuestion) => setQuestions((qs) => qs.map((x, j) => (j === i ? q : x)));

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft className="w-4 h-4" /> Admin</Link>
        <div className="flex gap-2">
          {lessonId && <Link href={`/learn/article/${lessonId}`} target="_blank"><Button variant="outline"><Eye className="w-4 h-4 mr-2" /> Ansehen</Button></Link>}
          {lessonId && <Button variant="ghost" className="text-destructive" onClick={remove}><Trash2 className="w-4 h-4" /></Button>}
          <Button onClick={save} disabled={busy}><Save className="w-4 h-4 mr-2" /> Speichern</Button>
        </div>
      </div>

      <h1 className="text-3xl md:text-4xl h-display">{lessonId ? 'Lektion bearbeiten' : 'Neue Lektion'}</h1>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-xs text-white/50 md:col-span-2">Titel<Input value={form.title} onChange={(e) => set('title', e.target.value)} /></label>
        <label className="space-y-1 text-xs text-white/50">Kurs
          <select className={selectCls} value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value, chapterId: '', subCategoryId: '' })}>
            {[...(courses ?? [])].sort((a, b) => a.order - b.order).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-white/50">Kapitel
          <select className={selectCls} value={form.chapterId} onChange={(e) => setForm({ ...form, chapterId: e.target.value, subCategoryId: '' })}>
            <option value="">– wählen –</option>
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-white/50">Unterthema (optional)
          <select className={selectCls} value={form.subCategoryId} onChange={(e) => set('subCategoryId', e.target.value)}>
            <option value="">– keins –</option>
            {chapterSubCats.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs text-white/50">Reihenfolge<Input type="number" value={form.order} onChange={(e) => set('order', Number(e.target.value))} /></label>
          <label className="space-y-1 text-xs text-white/50">Credits (max.)<Input type="number" min={0} value={form.maxPoints} onChange={(e) => set('maxPoints', Number(e.target.value))} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={form.hidden} onChange={(e) => set('hidden', e.target.checked)} className="w-4 h-4 accent-brand" />
          Entwurf – nur für Lehrpersonen sichtbar
        </label>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-white/60 mr-2">Inhalt</p>
          <div className="inline-flex rounded-full border border-white/15 p-0.5 text-xs">
            <button type="button" onClick={() => { setBlocksKey((k) => k + 1); setMode('blocks'); }}
              className={cn('px-3 h-7 rounded-full', mode === 'blocks' ? 'bg-primary text-white' : 'text-white/70')}>Bausteine</button>
            <button type="button" onClick={() => setMode('text')}
              className={cn('px-3 h-7 rounded-full', mode === 'text' ? 'bg-primary text-white' : 'text-white/70')}>Text</button>
          </div>
          {mode === 'text' && (
            <>
              <Button size="sm" variant="outline" onClick={() => insert('# Überschrift')}><Heading1 className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => insert('## Zwischentitel')}><Heading2 className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => insert('---')}><Minus className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => imageRef.current?.click()} disabled={busy}><ImagePlus className="w-4 h-4 mr-1" /> Bild</Button>
              <Button size="sm" variant="outline" onClick={() => insert('VIDEO: https://…mp4')}><Video className="w-4 h-4 mr-1" /> Video</Button>
              <select className="h-9 rounded-md bg-white/5 border border-white/15 px-2 text-sm" value="" onChange={(e) => e.target.value && insert(`GAME: ${e.target.value} | ${apps?.find((a) => a.id === e.target.value)?.name ?? 'Übung'}`)}>
                <option value="">+ Übung einbetten</option>
                {apps?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </>
          )}
          <button className={cn('ml-auto text-sm md:hidden', preview ? 'text-primary' : 'text-white/60')} onClick={() => setPreview(!preview)}>{preview ? 'Bearbeiten' : 'Vorschau'}</button>
          <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 items-start">
          <div className={cn(preview && 'hidden md:block')}>
            {mode === 'blocks' ? (
              <BlockEditor key={blocksKey} initial={initialBlocks} apps={apps ?? []}
                folder={lessonId ?? (slugify(form.title) || 'neu')} onChange={(content) => set('content', content)} />
            ) : (
              <Textarea ref={textRef} value={form.content} onChange={(e) => set('content', e.target.value)} rows={28}
                className="font-mono text-sm leading-relaxed"
                placeholder={'# Titel\n\nText mit **fetten** Wörtern.\n\n## Zwischentitel\n\nAbsätze durch eine Leerzeile trennen.'} />
            )}
          </div>
          <div className={cn('rounded-xl border border-white/10 bg-black p-6 md:sticky md:top-20 max-h-[calc(100vh-6rem)] overflow-y-auto', !preview && 'hidden md:block')}>
            <p className="eyebrow mb-4">Vorschau</p>
            {form.content.trim() ? <LessonContent content={form.content} /> : <p className="text-white/60 text-sm">Vorschau erscheint hier.</p>}
          </div>
        </div>
        {mode === 'text' && (
          <p className="text-xs text-white/60">
            Format: <code>#</code> Titel, <code>##</code> Zwischentitel, <code>###</code> Label, <code>**fett**</code>, <code>---</code> Trenner,
            <code> IMAGE: url | Unterschrift</code>, <code>VIDEO: url</code>, <code>YOUTUBE: url | Titel | Text</code>, <code>GAME: id | Text</code>,
            <code> TIP: tipp|merke|achtung|aufgabe | Titel</code> (Text in den Zeilen darunter), <code>PHASE: Titel | Text | lektionId</code>.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-xs text-white/60">Weitere YouTube-Videos ganz unten (für Tutorials im Text lieber den Baustein «YouTube-Tutorial»)</p>
        {form.youtubeUrls.map((u) => (
          <div key={u} className="flex items-center gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
            <span className="flex-1 truncate">{u}</span>
            <button onClick={() => set('youtubeUrls', form.youtubeUrls.filter((x) => x !== u))}><Trash2 className="w-4 h-4 text-white/60 hover:text-destructive" /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input value={newYoutube} onChange={(e) => setNewYoutube(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          <Button variant="outline" disabled={!newYoutube.trim()} onClick={() => { set('youtubeUrls', [...form.youtubeUrls, newYoutube.trim()]); setNewYoutube(''); }}><Plus className="w-4 h-4" /></Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/50">Quiz ({questions.length} Fragen) – ohne Fragen schliessen Schüler:innen mit «Als gelesen markieren» ab</p>
          <Button size="sm" variant="outline" onClick={() => setQuestions([...questions, { ...EMPTY_QUESTION, options: [...EMPTY_QUESTION.options] }])}><Plus className="w-4 h-4 mr-1" /> Frage</Button>
        </div>
        {questions.map((q, i) => (
          <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex gap-2">
              <Input value={q.question} onChange={(e) => updateQuestion(i, { ...q, question: e.target.value })} placeholder={`Frage ${i + 1}`} />
              <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {q.options.map((o, oi) => (
                <label key={oi} className={cn('flex items-center gap-2 rounded-lg px-2 py-1 border', q.correctOption === oi ? 'border-success/60 bg-success/10' : 'border-transparent')}>
                  <input type="radio" name={`correct-${i}`} checked={q.correctOption === oi} onChange={() => updateQuestion(i, { ...q, correctOption: oi })} className="accent-success" title="Richtige Antwort" />
                  <Input value={o} onChange={(e) => updateQuestion(i, { ...q, options: q.options.map((x, j) => (j === oi ? e.target.value : x)) })} placeholder={`Antwort ${oi + 1}`} />
                </label>
              ))}
            </div>
            <p className="text-xs text-white/60">Grün markiert = richtige Antwort. Leere Antworten werden weggelassen.</p>
          </div>
        ))}
      </section>

      <div className="flex justify-end"><Button onClick={save} disabled={busy}><Save className="w-4 h-4 mr-2" /> Speichern</Button></div>
    </div>
  );
}
