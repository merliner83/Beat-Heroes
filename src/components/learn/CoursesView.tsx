'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Award, CheckCircle2, Loader2, Route, Zap } from 'lucide-react';
import { useUser } from '@/firebase';
import { LearningPath } from '@/lib/game/types';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useLearnData } from './useLearnData';
import { LEARN_ICONS } from './icons';

function PathCard({ path, data }: { path: LearningPath; data: ReturnType<typeof useLearnData> }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const total = path.requiredLessonIds.length;
  const done = path.requiredLessonIds.filter((id) => data.passed(id, path.minScore ?? 80)).length;
  const achieved = data.achievedPathIds.has(path.id);
  const ready = !achieved && total > 0 && done === total;
  const titleById = new Map(data.articles.map((a) => [a.id, a.title]));
  const nextOpen = path.requiredLessonIds.find((id) => !data.passed(id, path.minScore ?? 80));

  const claim = async () => {
    if (!user) return;
    setBusy(true);
    const res = await apiPost<{ awarded: number; alreadyAchieved: boolean }>(user, '/api/paths/claim', { pathId: path.id });
    setBusy(false);
    if (!res.ok) {
      toast({ variant: 'destructive', title: 'Noch nicht ganz', description: res.error });
      return;
    }
    toast({ title: 'Lernpfad abgeschlossen!', description: res.data.awarded ? `+${res.data.awarded} Credits` : path.title });
  };

  return (
    <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col gap-3" style={{ borderColor: achieved ? '#00E67655' : undefined }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {path.official && <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FFEA00] mb-1">Offiziell</p>}
          <h4 className="font-black text-lg leading-tight">{path.title}</h4>
        </div>
        {achieved ? <Award className="w-7 h-7 text-[#00E676] shrink-0" /> : <Route className="w-6 h-6 text-white/30 shrink-0" />}
      </div>
      {path.description && <p className="text-sm text-white/60 whitespace-pre-line">{path.description}</p>}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-white/50">
          <span>{done} von {total} Lektionen</span>
          {!!path.credits && <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-[#FFEA00]" fill="currentColor" /> {path.credits} SC</span>}
        </div>
        <Progress value={total ? (done / total) * 100 : 0} className="h-1.5" />
      </div>
      {achieved && <p className="text-sm font-bold text-[#00E676] flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Abgeschlossen</p>}
      {ready && <Button onClick={claim} disabled={busy} className="bg-[#00E676] text-black hover:bg-[#00E676]/90">Abschluss bestätigen</Button>}
      {!achieved && !ready && nextOpen && (
        <Link href={`/learn/article/${nextOpen}`} className="text-sm text-primary flex items-center gap-1 hover:underline">
          Weiter mit: {titleById.get(nextOpen) ?? 'nächste Lektion'} <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

export function CoursesView() {
  const data = useLearnData();
  const { user } = useUser();

  if (data.loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-gradient">Lernen</h1>
        <p className="text-white/50 mt-2">Wähle einen Kurs. Lektionen kannst du frei in jeder Reihenfolge machen.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {data.courses.map((c) => {
          const stats = data.courseStats(c.id);
          const Icon = LEARN_ICONS[c.iconName ?? ''] ?? LEARN_ICONS.BookOpen;
          return (
            <Link key={c.id} href={`/learn/${c.id}`} className="group relative overflow-hidden p-6 md:p-8 rounded-[2rem] border border-white/10 bg-black hover:border-white/30 transition-colors">
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-[90px] opacity-30" style={{ backgroundColor: c.color }} />
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center"><Icon className="w-6 h-6" style={{ color: c.color }} /></div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter leading-none">{c.title}</h2>
                    {c.subtitle && <p className="text-sm text-white/50 mt-1">{c.subtitle}</p>}
                  </div>
                </div>
                {c.description && <p className="text-sm text-white/60">{c.description}</p>}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-white/50">
                    <span>{c.chapters.length} Kapitel · {stats.total} Lektionen</span>
                    {user && stats.total > 0 && <span>{stats.percent}%</span>}
                  </div>
                  {user && stats.total > 0 && <Progress value={stats.percent} className="h-1.5" />}
                  {stats.total === 0 && <p className="text-xs text-white/40">Lektionen folgen bald</p>}
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-bold group-hover:gap-2 transition-all" style={{ color: c.color }}>
                  Öffnen <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      {data.paths.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Route className="w-5 h-5 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/60">Lernpfade</h3>
          </div>
          {!user && <p className="text-sm text-white/40">Melde dich an, um deinen Fortschritt zu sehen.</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {data.paths.map((p) => <PathCard key={p.id} path={p} data={data} />)}
          </div>
        </section>
      )}
    </div>
  );
}
