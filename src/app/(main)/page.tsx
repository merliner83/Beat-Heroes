'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { ArrowRight, GraduationCap, Gamepad2, Loader2, Sparkles } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Article, isStaff } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { MyAssignments } from '@/components/assignments/MyAssignments';
import { JoinClassCard } from '@/components/assignments/JoinClassCard';

function QuickLink({ href, title, text, icon: Icon, color }: { href: string; title: string; text: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }) {
  return (
    <Link href={href} className="group p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/30 transition-colors flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center shrink-0"><Icon className="w-6 h-6" style={{ color }} /></div>
      <div className="flex-1 min-w-0">
        <h3 className="h-display text-xl">{title}</h3>
        <p className="text-sm text-white/50">{text}</p>
      </div>
      <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
    </Link>
  );
}

function Dashboard() {
  const db = useFirestore();
  const { user, profile, isUserLoading } = useUser();
  const inviteId = useSearchParams().get('invite');
  const invitedRef = useMemoFirebase(() => (inviteId && db ? doc(db, 'articles', inviteId) : null), [db, inviteId]);
  const { data: invited } = useDoc<Article>(invitedRef);
  const signedIn = !!user && !user.isAnonymous;
  const name = profile?.displayName || user?.displayName || 'Producer';

  if (isUserLoading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <section className="relative p-8 md:p-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-black to-black border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -z-10" />
        <h1 className="text-3xl md:text-5xl h-display text-gradient mb-3">
          {signedIn ? `Hey ${name.split(' ')[0]}` : 'Willkommen bei Beat Heroes'}
        </h1>
        <p className="text-white/60 max-w-2xl">
          {signedIn
            ? 'Hier siehst du deine Aufgaben. Lernen, Games und dein Profil findest du oben in der Navigation.'
            : 'Lerne Producing und Musikverstehen mit Games, sammle Credits und zeig deine Beats. Melde dich oben rechts an, damit dein Fortschritt gespeichert wird.'}
        </p>
      </section>

      {invited && (
        <Link href={`/learn/article/${invited.id}`} className="flex items-center justify-between gap-4 p-6 rounded-2xl gemini-border-primary bg-black/60">
          <div className="flex items-center gap-4">
            <Sparkles className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Für dich geteilt</p>
              <h2 className="text-xl font-black">{invited.title}</h2>
            </div>
          </div>
          <Button className="bg-white text-black rounded-full">Los <ArrowRight className="w-4 h-4 ml-1" /></Button>
        </Link>
      )}

      {signedIn && !isStaff(profile?.role) && !(profile?.classIds?.length) && <JoinClassCard />}
      {signedIn && <MyAssignments />}

      <section className="grid gap-4 md:grid-cols-2">
        <QuickLink href="/learn" title="Lernen" text="Producing-Wissen, Quizzes und Lern-Apps" icon={GraduationCap} color="#00E676" />
        <QuickLink href="/games" title="Games" text="Rhythmus-Games in den Studios" icon={Gamepad2} color="#FF3399" />
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-64 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <Dashboard />
    </Suspense>
  );
}
