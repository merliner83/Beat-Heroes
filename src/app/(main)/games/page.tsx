'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collection, query } from 'firebase/firestore';
import { Headphones, LayoutGrid, Loader2, Music, Search, Target, Disc3, ExternalLink } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Game, GameType, LearnApp, Level, LevelProgress, Studio, getAccuracyColor, hasAccess } from '@/lib/game/types';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ds';

type Filter = 'all' | GameType | 'learn';

const GAME_INFO: Record<GameType, { title: string; text: string; color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  'rhythm-producer': { title: 'Beat Hero', text: 'Spiel die Drums auf den Pads im Takt zum Beat.', color: '#FF3399', icon: Music },
  'sample-hunter': { title: 'Vinyl Hunter', text: 'Fang die Samples im richtigen Moment ein.', color: '#00FFFF', icon: LayoutGrid },
  'sample-catcher': { title: 'Sample Catcher', text: 'Folge den Rhythmus-Patterns und catch jedes Sample.', color: '#FFEA00', icon: Disc3 },
};

const LEARN_GAME_INFO: Record<string, { text: string; color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  'ear-training': { text: 'Trainiere dein Gehör für Frequenzen und EQ.', color: '#00E676', icon: Headphones },
  'rhythm-trainer': { text: 'Klopf Rhythmus-Patterns exakt nach.', color: '#FFEA00', icon: Target },
};

const TYPE_ORDER: GameType[] = ['rhythm-producer', 'sample-hunter', 'sample-catcher'];

export default function GamesPage() {
  const db = useFirestore();
  const { user, profile } = useUser();
  const [filter, setFilter] = useState<Filter>('all');
  const [studioFilter, setStudioFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const studiosQ = useMemoFirebase(() => (db ? query(collection(db, 'studios')) : null), [db]);
  const gamesQ = useMemoFirebase(() => (db ? query(collection(db, 'games')) : null), [db]);
  const levelsQ = useMemoFirebase(() => (db ? query(collection(db, 'levels')) : null), [db]);
  const appsQ = useMemoFirebase(() => (db ? query(collection(db, 'learnApps')) : null), [db]);
  const progressQ = useMemoFirebase(() => (db && user ? query(collection(db, 'users', user.uid, 'progress')) : null), [db, user]);
  const { data: studios, isLoading } = useCollection<Studio>(studiosQ);
  const { data: games } = useCollection<Game>(gamesQ);
  const { data: levels } = useCollection<Level>(levelsQ);
  const { data: apps } = useCollection<LearnApp>(appsQ);
  const { data: progress } = useCollection<LevelProgress>(progressQ);

  const studioById = useMemo(() => new Map((studios ?? []).map((s) => [s.id, s])), [studios]);
  const accuracyByLevel = useMemo(() => new Map((progress ?? []).map((p) => [p.levelId ?? p.id, p.accuracy])), [progress]);

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (games ?? [])
      .filter((g) => studioById.has(g.studioId))
      .filter((g) => hasAccess(profile?.role, g.minRole) && hasAccess(profile?.role, studioById.get(g.studioId)?.minRole))
      .filter((g) => filter === 'all' || g.type === filter)
      .filter((g) => studioFilter === 'all' || g.studioId === studioFilter)
      .filter((g) => !q || `${GAME_INFO[g.type]?.title} ${studioById.get(g.studioId)?.name}`.toLowerCase().includes(q))
      .map((g) => ({
        game: g,
        studio: studioById.get(g.studioId)!,
        levels: (levels ?? []).filter((l) => l.gameId === g.id).sort((a, b) => a.difficulty - b.difficulty),
      }))
      .sort((a, b) => TYPE_ORDER.indexOf(a.game.type) - TYPE_ORDER.indexOf(b.game.type) || a.studio.name.localeCompare(b.studio.name, 'de'));
  }, [games, levels, studioById, filter, studioFilter, search, profile?.role]);

  const learnGames = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!(filter === 'all' || filter === 'learn') || studioFilter !== 'all') return [];
    return (apps ?? []).filter((a) => hasAccess(profile?.role, a.minRole)).filter((a) => !q || a.name.toLowerCase().includes(q));
  }, [apps, filter, studioFilter, search, profile?.role]);

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Alle' },
    ...TYPE_ORDER.map((t) => ({ id: t as Filter, label: GAME_INFO[t].title })),
    { id: 'learn', label: 'Lern-Games' },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Games" subtitle="Alle Games auf einen Blick. Jedes Spiel gibt es in den Studios mit eigenem Beat und Tempo." />

      <section className="grid gap-3 md:grid-cols-3">
        {TYPE_ORDER.map((t) => {
          const info = GAME_INFO[t];
          const Icon = info.icon;
          return (
            <button key={t} onClick={() => setFilter(filter === t ? 'all' : t)}
              className={cn('text-left p-5 rounded-2xl border bg-black transition-colors relative overflow-hidden', filter === t ? 'border-white/40' : 'border-white/10 hover:border-white/25')}>
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-[60px] opacity-30" style={{ backgroundColor: info.color }} />
              <Icon className="w-7 h-7 mb-3 relative" style={{ color: info.color }} />
              <h2 className="text-xl h-display relative">{info.title}</h2>
              <p className="text-sm text-white/50 relative">{info.text}</p>
            </button>
          );
        })}
      </section>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button key={c.id} onClick={() => setFilter(c.id)}
              className={cn('px-4 h-9 rounded-full text-sm font-bold border transition-colors', filter === c.id ? 'bg-primary border-primary text-white' : 'border-white/15 text-white/60 hover:text-white')}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 md:ml-auto">
          <select value={studioFilter} onChange={(e) => setStudioFilter(e.target.value)}
            className="h-9 rounded-md bg-white/5 border border-white/15 px-3 text-sm" aria-label="Studio">
            <option value="all">Alle Studios</option>
            {[...(studios ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen" className="h-9 pl-9 w-40 md:w-56" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {learnGames.map((app) => {
            const info = LEARN_GAME_INFO[app.type] ?? { text: '', color: '#fff', icon: Target };
            const Icon = info.icon;
            return (
              <Link key={app.id} href={`/session/${app.id}`} className="p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-white/30 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Icon className="w-7 h-7" style={{ color: info.color }} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Lern-Game</p>
                    <h3 className="h-display text-lg">{app.name}</h3>
                  </div>
                </div>
                <p className="text-sm text-white/50">{info.text}</p>
              </Link>
            );
          })}

          {entries.map(({ game, studio, levels: gameLevels }) => {
            const info = GAME_INFO[game.type];
            return (
              <div key={game.id} className="rounded-2xl border border-white/10 bg-black overflow-hidden flex flex-col">
                <div className="relative h-28">
                  {studio.imageUrl
                    ? <Image src={studio.imageUrl} alt={studio.name} fill className="object-cover opacity-70" sizes="(max-width: 640px) 100vw, 33vw" />
                    : <div className="absolute inset-0" style={{ backgroundColor: studio.coverColor }} />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: info?.color }}>{info?.title ?? game.name}</p>
                      <h3 className="h-display text-xl leading-none">{studio.name}</h3>
                    </div>
                    {game.bpm && <span className="text-xs font-bold text-white/70 shrink-0">{game.bpm} BPM</span>}
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="flex flex-wrap gap-2">
                    {gameLevels.map((l, idx) => {
                      const acc = accuracyByLevel.get(l.id);
                      return (
                        <Link key={l.id} href={`/session/${l.id}`} title={l.name}
                          className="w-11 h-11 rounded-xl border flex flex-col items-center justify-center text-sm font-black hover:scale-105 transition-transform"
                          style={{ borderColor: acc != null ? getAccuracyColor(acc) : 'rgba(255,255,255,0.15)', color: acc != null ? getAccuracyColor(acc) : undefined }}>
                          {idx + 1}
                          {acc != null && <span className="text-xs font-bold leading-none">{acc}%</span>}
                        </Link>
                      );
                    })}
                    {gameLevels.length === 0 && <p className="text-sm text-white/60">Noch keine Levels.</p>}
                  </div>
                  <Link href={`/studio/${studio.id}`} className="mt-auto text-xs text-white/60 hover:text-white flex items-center gap-1">
                    Studio & Tracks <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
          {entries.length === 0 && learnGames.length === 0 && <p className="text-white/60">Keine Games gefunden.</p>}
        </div>
      )}
    </div>
  );
}
