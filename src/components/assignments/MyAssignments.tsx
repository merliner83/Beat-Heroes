'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { CheckCircle2, Clock, Send, MessageSquareWarning, Zap, ArrowRight, ClipboardList } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { Assignment, Submission, assignmentHref } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const KIND_LABEL: Record<Assignment['kind'], string> = {
  task: 'Aufgabe',
  level: 'Game',
  learnApp: 'Lern-App',
  article: 'Lektion',
};

export function formatDue(dueAt: any): string | null {
  if (!dueAt) return null;
  const d = dueAt?.toDate ? dueAt.toDate() : new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Lädt die Zuweisungen der angemeldeten Person (Klassen + persönliche). */
function useMyAssignments() {
  const db = useFirestore();
  const { user, profile } = useUser();
  const classIds = useMemo(() => profile?.classIds ?? [], [profile?.classIds]);
  const classKey = classIds.join(',');
  const [byKey, setByKey] = useState<Record<string, Assignment[]>>({});

  useEffect(() => {
    if (!db || !user) return;
    const unsubs: (() => void)[] = [];
    const listen = (key: string, q: ReturnType<typeof query>) => {
      unsubs.push(onSnapshot(q, (snap) => {
        setByKey((prev) => ({ ...prev, [key]: snap.docs.map((d) => ({ ...(d.data() as Assignment), id: d.id })) }));
      }, (err) => console.warn('assignments', key, err)));
    };
    listen('me', query(collection(db, 'assignments'), where('studentIds', 'array-contains', user.uid)));
    classIds.forEach((cid) => listen(`class:${cid}`,
      query(collection(db, 'assignments'), where('classId', '==', cid), where('audience', '==', 'class'))));
    return () => { unsubs.forEach((u) => u()); setByKey({}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, user, classKey]);

  return useMemo(() => {
    const map = new Map<string, Assignment>();
    Object.values(byKey).flat().forEach((a) => map.set(a.id, a));
    const due = (a: Assignment) => (a.dueAt?.toMillis ? a.dueAt.toMillis() : Number.MAX_SAFE_INTEGER);
    return [...map.values()].sort((a, b) => due(a) - due(b));
  }, [byKey]);
}

function useMySubmissions(assignmentIds: string[]) {
  const db = useFirestore();
  const { user } = useUser();
  const key = assignmentIds.join(',');
  const [subs, setSubs] = useState<Record<string, Submission | null>>({});
  useEffect(() => {
    if (!db || !user) return;
    const unsubs = assignmentIds.map((id) =>
      onSnapshot(doc(db, 'assignments', id, 'submissions', user.uid), (snap) => {
        setSubs((prev) => ({ ...prev, [id]: snap.exists() ? ({ ...(snap.data() as Submission), id: snap.id }) : null }));
      }, () => setSubs((prev) => ({ ...prev, [id]: null }))));
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, user, key]);
  return subs;
}

function StatusBadge({ submission }: { submission: Submission | null | undefined }) {
  if (!submission) return <Badge variant="outline" className="border-white/20 text-white/60"><Clock className="w-3 h-3 mr-1" /> Offen</Badge>;
  if (submission.status === 'approved') return <Badge className="bg-success text-black hover:bg-success"><CheckCircle2 className="w-3 h-3 mr-1" /> Erledigt</Badge>;
  if (submission.status === 'changes_requested') return <Badge className="bg-warning text-black hover:bg-warning"><MessageSquareWarning className="w-3 h-3 mr-1" /> Überarbeiten</Badge>;
  return <Badge className="bg-primary/80 hover:bg-primary/80"><Send className="w-3 h-3 mr-1" /> Eingereicht</Badge>;
}

export function MyAssignments() {
  const db = useFirestore();
  const { user, profile } = useUser();
  const { toast } = useToast();
  const assignments = useMyAssignments();
  const submissions = useMySubmissions(assignments.map((a) => a.id));
  const [active, setActive] = useState<Assignment | null>(null);
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);

  const openSubmit = (a: Assignment) => {
    const s = submissions[a.id];
    setText(s?.text ?? '');
    setLink(s?.link ?? '');
    setActive(a);
  };

  const submit = async () => {
    if (!db || !user || !active) return;
    if (link && !/^https?:\/\//i.test(link)) {
      toast({ variant: 'destructive', title: 'Link muss mit https:// beginnen' });
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'assignments', active.id, 'submissions', user.uid), {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || 'Producer',
        status: 'submitted',
        text: text.slice(0, 4000),
        link: link.slice(0, 500),
        submittedAt: serverTimestamp(),
      }, { merge: true });
      toast({ title: 'Abgegeben', description: 'Deine Lehrperson schaut es sich an.' });
      setActive(null);
    } catch (err) {
      console.warn(err);
      toast({ variant: 'destructive', title: 'Abgabe fehlgeschlagen' });
    } finally {
      setSaving(false);
    }
  };

  const open = assignments.filter((a) => submissions[a.id]?.status !== 'approved');
  const done = assignments.filter((a) => submissions[a.id]?.status === 'approved');

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <ClipboardList className="w-5 h-5 text-primary" />
        <h3 className="text-base font-bold text-white/90">Meine Aufgaben</h3>
      </div>

      {assignments.length === 0 ? (
        <p className="text-sm text-white/60 p-6 rounded-2xl bg-white/5 border border-white/5">
          Noch keine Aufgaben. Sobald deine Lehrperson dir etwas zuweist, erscheint es hier.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {[...open, ...done].map((a) => {
            const s = submissions[a.id];
            const href = assignmentHref(a);
            const due = formatDue(a.dueAt);
            const isDone = s?.status === 'approved';
            return (
              <div key={a.id} className={cn('p-5 rounded-2xl border bg-white/[0.03] flex flex-col gap-3', isDone ? 'border-white/5 opacity-60' : 'border-white/10')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                      {KIND_LABEL[a.kind]}{a.refLabel ? ` · ${a.refLabel}` : ''}
                    </p>
                    <h4 className="font-black text-lg leading-tight">{a.title}</h4>
                  </div>
                  <StatusBadge submission={s} />
                </div>
                {a.description && <p className="text-sm text-white/60 whitespace-pre-line">{a.description}</p>}
                {s?.status === 'changes_requested' && s.feedback && (
                  <p className="text-sm text-warning bg-warning/10 rounded-xl p-3 whitespace-pre-line">{s.feedback}</p>
                )}
                {s?.status === 'approved' && s.feedback && (
                  <p className="text-sm text-success bg-success/10 rounded-xl p-3 whitespace-pre-line">{s.feedback}</p>
                )}
                <div className="flex items-center justify-between gap-3 mt-auto pt-1">
                  <div className="flex items-center gap-3 text-xs text-white/50">
                    {due && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> bis {due}</span>}
                    {a.credits > 0 && <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-credit" fill="currentColor" /> {a.credits} SC</span>}
                  </div>
                  {!isDone && (
                    <div className="flex gap-2">
                      {href && (
                        <Link href={href}><Button size="sm" variant="outline" className="border-white/20">Öffnen <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
                      )}
                      <Button size="sm" onClick={() => openSubmit(a)}>{s ? 'Erneut abgeben' : 'Abgeben'}</Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 text-white">
          <DialogHeader><DialogTitle>{active?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Was hast du gemacht? Notiz an deine Lehrperson" value={text} onChange={(e) => setText(e.target.value)} rows={5} />
            <Input placeholder="Link (z.B. SoundCloud, YouTube, Google Drive) – optional" value={link} onChange={(e) => setLink(e.target.value)} />
            <Button onClick={submit} disabled={saving || (!text.trim() && !link.trim())} className="w-full">Abgeben</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
