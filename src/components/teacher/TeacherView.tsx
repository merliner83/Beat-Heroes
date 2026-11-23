'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, where, deleteDoc, limit } from 'firebase/firestore';
import { Award, Loader2, Plus, Users, ClipboardList, Copy, CheckCircle2, MessageSquareWarning, ChevronDown, ChevronUp, Trash2, ExternalLink } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import {
  Achievement, Article, Assignment, AssignmentKind, Game, LearnApp, Level, School, SchoolClass, Submission, UserProfile, isSuperAdmin,
} from '@/lib/game/types';
import { apiPost } from '@/lib/api';
import { formatDue } from '@/components/assignments/MyAssignments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Person = UserProfile & { id: string };

const KIND_OPTIONS: { value: AssignmentKind; label: string }[] = [
  { value: 'task', label: 'Freie Aufgabe (z.B. Beat bauen)' },
  { value: 'article', label: 'Lektion lesen + Quiz' },
  { value: 'level', label: 'Game-Level spielen' },
  { value: 'learnApp', label: 'Lern-App' },
];

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

// ---------- Klassen ----------

function CreateClass({ schoolId }: { schoolId: string }) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!db || !user || !name.trim()) return;
    setBusy(true);
    try {
      let code = randomCode();
      for (let i = 0; i < 5; i++) {
        const clash = await getDocs(query(collection(db, 'classes'), where('schoolId', '==', schoolId), where('joinCode', '==', code), limit(1)));
        if (clash.empty) break;
        code = randomCode();
      }
      await addDoc(collection(db, 'classes'), {
        schoolId, name: name.trim(), teacherIds: [user.uid], joinCode: code, createdAt: serverTimestamp(),
      });
      setName('');
      toast({ title: 'Klasse angelegt', description: `Beitrittscode ${code}` });
    } catch (err) {
      console.warn(err);
      toast({ variant: 'destructive', title: 'Anlegen fehlgeschlagen' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Input placeholder="Neue Klasse, z.B. Producing Mittwoch" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
      <Button onClick={create} disabled={busy || !name.trim()}><Plus className="w-4 h-4 mr-1" /> Klasse</Button>
    </div>
  );
}

// ---------- Inhalte für Zuweisungen ----------

type RefOption = { id: string; label: string };

function useRefOptions() {
  const db = useFirestore();
  const articlesQ = useMemoFirebase(() => (db ? query(collection(db, 'articles')) : null), [db]);
  const appsQ = useMemoFirebase(() => (db ? query(collection(db, 'learnApps')) : null), [db]);
  const gamesQ = useMemoFirebase(() => (db ? query(collection(db, 'games')) : null), [db]);
  const levelsQ = useMemoFirebase(() => (db ? query(collection(db, 'levels')) : null), [db]);
  const { data: articles } = useCollection<Article>(articlesQ);
  const { data: apps } = useCollection<LearnApp>(appsQ);
  const { data: games } = useCollection<Game>(gamesQ);
  const { data: levels } = useCollection<Level>(levelsQ);

  return useMemo(() => {
    const byName = (a: RefOption, b: RefOption) => a.label.localeCompare(b.label, 'de');
    const gameName = new Map((games ?? []).map((g) => [g.id, g.name]));
    return {
      task: [] as RefOption[],
      article: (articles ?? []).map((a) => ({ id: a.id, label: a.title })).sort(byName),
      learnApp: (apps ?? []).map((a) => ({ id: a.id, label: a.name })).sort(byName),
      level: (levels ?? []).map((l) => ({ id: l.id, label: `${gameName.get(l.gameId) ?? l.gameId} – ${l.name ?? `Level ${l.difficulty}`}` })).sort(byName),
    } satisfies Record<AssignmentKind, RefOption[]>;
  }, [articles, apps, games, levels]);
}

function CreateAssignment({ schoolClass, students, onDone }: { schoolClass: SchoolClass; students: Person[]; onDone: () => void }) {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const refOptions = useRefOptions();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<AssignmentKind>('task');
  const [refId, setRefId] = useState('');
  const [due, setDue] = useState('');
  const [credits, setCredits] = useState('100');
  const [audience, setAudience] = useState<'class' | 'students'>('class');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const ref = refOptions[kind].find((o) => o.id === refId);
  const valid = title.trim() && (kind === 'task' || ref) && (audience === 'class' || picked.length > 0);

  const save = async () => {
    if (!db || !user || !valid) return;
    setBusy(true);
    try {
      await addDoc(collection(db, 'assignments'), {
        schoolId: schoolClass.schoolId,
        classId: schoolClass.id,
        audience,
        studentIds: audience === 'students' ? picked : [],
        createdBy: user.uid,
        title: title.trim(),
        description: description.trim(),
        kind,
        refId: kind === 'task' ? null : refId,
        refLabel: kind === 'task' ? null : ref?.label ?? null,
        dueAt: due ? Timestamp.fromDate(new Date(`${due}T23:59:00`)) : null,
        credits: Math.max(0, Math.min(5000, Number(credits) || 0)),
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Aufgabe zugewiesen' });
      onDone();
    } catch (err) {
      console.warn(err);
      toast({ variant: 'destructive', title: 'Zuweisen fehlgeschlagen' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input placeholder="Titel, z.B. «Baue einen Boom-Bap-Beat mit 90 BPM»" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea placeholder="Beschreibung (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      <Select value={kind} onValueChange={(v) => { setKind(v as AssignmentKind); setRefId(''); }}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{KIND_OPTIONS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
      </Select>
      {kind !== 'task' && (
        <Select value={refId} onValueChange={setRefId}>
          <SelectTrigger><SelectValue placeholder="Inhalt wählen" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {refOptions[kind].map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-white/50 space-y-1">Fällig bis (optional)<Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        <label className="text-xs text-white/50 space-y-1">Credits bei Freigabe<Input type="number" min={0} max={5000} value={credits} onChange={(e) => setCredits(e.target.value)} /></label>
      </div>
      <Select value={audience} onValueChange={(v) => setAudience(v as 'class' | 'students')}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="class">Ganze Klasse</SelectItem>
          <SelectItem value="students">Einzelne Schüler:innen</SelectItem>
        </SelectContent>
      </Select>
      {audience === 'students' && (
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-white/[0.03]">
          {students.length === 0 && <p className="text-sm text-white/40 col-span-2">Noch niemand in der Klasse.</p>}
          {students.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={picked.includes(s.id)} onCheckedChange={(c) => setPicked((p) => (c ? [...p, s.id] : p.filter((x) => x !== s.id)))} />
              {s.displayName || 'Ohne Namen'}
            </label>
          ))}
        </div>
      )}
      <Button onClick={save} disabled={busy || !valid} className="w-full">Zuweisen</Button>
    </div>
  );
}

// ---------- Abgaben ----------

function ReviewDialog({ assignment, submission, onClose }: { assignment: Assignment; submission: Submission; onClose: () => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [busy, setBusy] = useState(false);

  const review = async (status: 'approved' | 'changes_requested') => {
    if (!user) return;
    setBusy(true);
    const res = await apiPost<{ awarded: number }>(user, '/api/assignments/review', {
      assignmentId: assignment.id, studentId: submission.id, status, feedback,
    });
    setBusy(false);
    if (!res.ok) {
      toast({ variant: 'destructive', title: 'Speichern fehlgeschlagen', description: res.error });
      return;
    }
    toast({
      title: status === 'approved' ? 'Freigegeben' : 'Zurück zur Überarbeitung',
      description: res.data.awarded ? `+${res.data.awarded} Credits` : undefined,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 text-white">
        <DialogHeader><DialogTitle>{submission.displayName || 'Abgabe'} – {assignment.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {submission.text && <p className="text-sm whitespace-pre-line bg-white/5 rounded-xl p-3">{submission.text}</p>}
          {submission.link && (
            <a href={submission.link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 break-all">
              <ExternalLink className="w-4 h-4 shrink-0" /> {submission.link}
            </a>
          )}
          <Textarea placeholder="Feedback an die Schülerin / den Schüler" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-[#FF9100]/50 text-[#FF9100]" disabled={busy} onClick={() => review('changes_requested')}>
              <MessageSquareWarning className="w-4 h-4 mr-1" /> Überarbeiten
            </Button>
            <Button className="flex-1 bg-[#00E676] text-black hover:bg-[#00E676]/90" disabled={busy} onClick={() => review('approved')}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Freigeben{assignment.credits ? ` (+${assignment.credits})` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentRow({ assignment, students }: { assignment: Assignment; students: Person[] }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState<Submission | null>(null);
  const subsQuery = useMemoFirebase(() => (db ? query(collection(db, 'assignments', assignment.id, 'submissions')) : null), [db, assignment.id]);
  const { data: submissions } = useCollection<Submission>(subsQuery);

  const targets = assignment.audience === 'class' ? students : students.filter((s) => assignment.studentIds.includes(s.id));
  const subById = new Map((submissions ?? []).map((s) => [s.id, s]));
  const pending = (submissions ?? []).filter((s) => s.status === 'submitted').length;
  const approved = (submissions ?? []).filter((s) => s.status === 'approved').length;
  const due = formatDue(assignment.dueAt);

  const remove = async () => {
    if (!db || !confirm(`Aufgabe «${assignment.title}» löschen?`)) return;
    try {
      await deleteDoc(doc(db, 'assignments', assignment.id));
    } catch {
      toast({ variant: 'destructive', title: 'Löschen fehlgeschlagen' });
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
      <button onClick={() => setOpen((o) => !o)} className="w-full p-4 flex items-center gap-3 text-left">
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{assignment.title}</p>
          <p className="text-xs text-white/40 truncate">
            {assignment.refLabel ?? 'Freie Aufgabe'}{due ? ` · bis ${due}` : ''} · {assignment.audience === 'class' ? 'ganze Klasse' : `${assignment.studentIds.length} Person(en)`}
          </p>
        </div>
        {pending > 0 && <Badge className="bg-primary hover:bg-primary">{pending} neu</Badge>}
        <span className="text-xs text-white/50 shrink-0">{approved}/{targets.length} ✓</span>
        {open ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {assignment.description && <p className="text-sm text-white/60 whitespace-pre-line">{assignment.description}</p>}
          {targets.length === 0 && <p className="text-sm text-white/40">Noch niemand in der Klasse.</p>}
          {targets.map((s) => {
            const sub = subById.get(s.id);
            return (
              <div key={s.id} className="flex items-center gap-3 text-sm py-1.5 border-t border-white/5">
                <span className="flex-1 truncate">{s.displayName || 'Ohne Namen'}</span>
                {!sub && <span className="text-white/30">offen</span>}
                {sub?.status === 'approved' && <span className="text-[#00E676]">freigegeben</span>}
                {sub?.status === 'changes_requested' && <span className="text-[#FF9100]">überarbeiten</span>}
                {sub && <Button size="sm" variant={sub.status === 'submitted' ? 'default' : 'outline'} onClick={() => setReviewing(sub)}>
                  {sub.status === 'submitted' ? 'Prüfen' : 'Ansehen'}
                </Button>}
              </div>
            );
          })}
          <div className="pt-2 flex justify-end">
            <Button size="sm" variant="ghost" className="text-destructive" onClick={remove}><Trash2 className="w-4 h-4 mr-1" /> Löschen</Button>
          </div>
        </div>
      )}
      {reviewing && <ReviewDialog assignment={assignment} submission={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}

// ---------- Klassendetail ----------

function ClassDetail({ schoolClass }: { schoolClass: SchoolClass }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);

  const studentsQuery = useMemoFirebase(() => (db ? query(collection(db, 'users'),
    where('schoolId', '==', schoolClass.schoolId), where('classIds', 'array-contains', schoolClass.id)) : null), [db, schoolClass.schoolId, schoolClass.id]);
  const { data: students } = useCollection<UserProfile>(studentsQuery);

  const assignmentsQuery = useMemoFirebase(() => (db ? query(collection(db, 'assignments'),
    where('schoolId', '==', schoolClass.schoolId), where('classId', '==', schoolClass.id)) : null), [db, schoolClass.schoolId, schoolClass.id]);
  const { data: assignments } = useCollection<Assignment>(assignmentsQuery);

  const achievementsQuery = useMemoFirebase(() => (db ? query(collection(db, 'achievements'),
    where('schoolId', '==', schoolClass.schoolId), where('classIds', 'array-contains', schoolClass.id)) : null), [db, schoolClass.schoolId, schoolClass.id]);
  const { data: achievements } = useCollection<Achievement>(achievementsQuery);
  const achievementsByUid = useMemo(() => {
    const m = new Map<string, Achievement[]>();
    (achievements ?? []).forEach((a) => m.set(a.uid, [...(m.get(a.uid) ?? []), a]));
    return m;
  }, [achievements]);

  const sortedAssignments = useMemo(() => [...(assignments ?? [])].sort((a, b) =>
    (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)), [assignments]);
  const studentList = useMemo(() => [...(students ?? [])].sort((a, b) =>
    (a.displayName ?? '').localeCompare(b.displayName ?? '', 'de')), [students]);

  const copyCode = () => {
    navigator.clipboard.writeText(schoolClass.joinCode);
    toast({ title: 'Code kopiert', description: schoolClass.joinCode });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter">{schoolClass.name}</h2>
        <button onClick={copyCode} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10">
          <span className="text-xs text-white/50">Beitrittscode</span>
          <span className="font-black tracking-[0.3em]">{schoolClass.joinCode}</span>
          <Copy className="w-4 h-4 text-white/50" />
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" /><h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/60">Aufgaben</h3></div>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1" /> Neue Aufgabe</Button>
        </div>
        {sortedAssignments.length === 0 && <p className="text-sm text-white/40">Noch keine Aufgaben zugewiesen.</p>}
        {sortedAssignments.map((a) => <AssignmentRow key={a.id} assignment={a} students={studentList} />)}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" /><h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/60">Schüler:innen ({studentList.length})</h3></div>
        {studentList.length === 0 && <p className="text-sm text-white/40">Noch niemand beigetreten. Gib den Beitrittscode weiter; die Schüler:innen geben ihn nach dem Login auf der Startseite ein.</p>}
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {studentList.map((s) => (
            <div key={s.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{s.displayName || 'Ohne Namen'}</span>
                <span className="text-xs text-white/40 shrink-0">{(s.streetCred ?? 0).toLocaleString('de-CH')} SC</span>
              </div>
              {(achievementsByUid.get(s.id) ?? []).map((a) => (
                <p key={a.id} className={cn('text-xs flex items-center gap-1', a.official ? 'text-[#FFEA00]' : 'text-[#00E676]')}>
                  <Award className="w-3.5 h-3.5 shrink-0" /> {a.pathTitle}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Neue Aufgabe für {schoolClass.name}</DialogTitle></DialogHeader>
          <CreateAssignment schoolClass={schoolClass} students={studentList} onDone={() => setCreating(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Seite ----------

export function TeacherView() {
  const db = useFirestore();
  const { profile, isUserLoading } = useUser();
  const superAdmin = isSuperAdmin(profile?.role);
  const [pickedSchool, setPickedSchool] = useState<string | null>(null);
  const schoolId = profile?.schoolId ?? pickedSchool;

  const schoolsQuery = useMemoFirebase(() => (db && superAdmin ? query(collection(db, 'schools')) : null), [db, superAdmin]);
  const { data: schools } = useCollection<School>(schoolsQuery);
  useEffect(() => {
    if (!profile?.schoolId && !pickedSchool && schools?.length) setPickedSchool(schools[0].id);
  }, [profile?.schoolId, pickedSchool, schools]);

  const classesQuery = useMemoFirebase(() => (db && schoolId ? query(collection(db, 'classes'), where('schoolId', '==', schoolId)) : null), [db, schoolId]);
  const { data: classes, isLoading } = useCollection<SchoolClass>(classesQuery);
  const sortedClasses = useMemo(() => [...(classes ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de')), [classes]);
  const [selected, setSelected] = useState<string | null>(null);
  const current = sortedClasses.find((c) => c.id === selected) ?? sortedClasses[0];

  if (isUserLoading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  if (!schoolId) {
    return (
      <div className="max-w-xl space-y-3 py-10">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter">Lehrperson</h1>
        <p className="text-white/60">
          {superAdmin ? 'Lege zuerst im Admin-Bereich eine Schule an.' : 'Dir ist noch keine Schule zugewiesen. Bitte melde dich bei der Administration.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[280px_1fr]">
      <aside className="space-y-4">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter">Klassen</h1>
        {superAdmin && !profile?.schoolId && schools && (
          <Select value={schoolId} onValueChange={(v) => { setPickedSchool(v); setSelected(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <CreateClass schoolId={schoolId} />
        {isLoading && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
        <div className="space-y-1">
          {sortedClasses.map((c) => (
            <button key={c.id} onClick={() => setSelected(c.id)}
              className={cn('w-full text-left px-4 py-3 rounded-xl font-bold transition-colors', current?.id === c.id ? 'bg-primary text-white' : 'bg-white/[0.03] hover:bg-white/[0.07]')}>
              {c.name}
            </button>
          ))}
        </div>
      </aside>
      <div>
        {current ? <ClassDetail key={current.id} schoolClass={current} /> : (
          <p className="text-white/50 py-10">Lege links deine erste Klasse an. Du bekommst einen Beitrittscode für die Schüler:innen.</p>
        )}
      </div>
    </div>
  );
}
