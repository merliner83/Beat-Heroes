'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, query } from 'firebase/firestore';
import { Handshake, Loader2, Search } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { ARTIST_GENRES, ARTIST_ROLES, PublicProfile } from '@/lib/game/types';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function ArtistsPage() {
  const db = useFirestore();
  const profilesQ = useMemoFirebase(() => (db ? query(collection(db, 'profiles')) : null), [db]);
  const { data: profiles, isLoading } = useCollection<PublicProfile>(profilesQ);
  const [search, setSearch] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [genre, setGenre] = useState('all');
  const [school, setSchool] = useState('all');
  const [collabOnly, setCollabOnly] = useState(false);

  const schools = useMemo(() => {
    const m = new Map<string, string>();
    (profiles ?? []).forEach((p) => p.schoolId && m.set(p.schoolId, p.schoolName ?? p.schoolId));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'de'));
  }, [profiles]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (profiles ?? [])
      .filter((p) => !q || `${p.artistName} ${p.bio ?? ''} ${p.roles.join(' ')} ${p.genres.join(' ')}`.toLowerCase().includes(q))
      .filter((p) => roles.length === 0 || roles.some((r) => p.roles.includes(r)))
      .filter((p) => genre === 'all' || p.genres.includes(genre))
      .filter((p) => school === 'all' || p.schoolId === school)
      .filter((p) => !collabOnly || p.openForCollab)
      .sort((a, b) => a.artistName.localeCompare(b.artistName, 'de'));
  }, [profiles, search, roles, genre, school, collabOnly]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-gradient">Artists</h1>
        <p className="text-white/50 mt-2">Producer, Rapper:innen, Sänger:innen und Musiker:innen der Musikschulen. Finde deine nächste Kollabo.</p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, Genre, Stil …" className="pl-9" />
          </div>
          <select value={genre} onChange={(e) => setGenre(e.target.value)} className="h-10 rounded-md bg-white/5 border border-white/15 px-3 text-sm" aria-label="Genre">
            <option value="all">Alle Genres</option>
            {ARTIST_GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {schools.length > 1 && (
            <select value={school} onChange={(e) => setSchool(e.target.value)} className="h-10 rounded-md bg-white/5 border border-white/15 px-3 text-sm" aria-label="Schule">
              <option value="all">Alle Schulen</option>
              {schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {ARTIST_ROLES.map((r) => {
            const on = roles.includes(r);
            return (
              <button key={r} onClick={() => setRoles(on ? roles.filter((x) => x !== r) : [...roles, r])}
                className={cn('px-3 h-8 rounded-full text-sm font-bold border transition-colors', on ? 'bg-primary border-primary text-white' : 'border-white/15 text-white/60 hover:text-white')}>
                {r}
              </button>
            );
          })}
          <button onClick={() => setCollabOnly(!collabOnly)}
            className={cn('px-3 h-8 rounded-full text-sm font-bold border transition-colors flex items-center gap-1', collabOnly ? 'bg-[#00E676] border-[#00E676] text-black' : 'border-white/15 text-white/60 hover:text-white')}>
            <Handshake className="w-4 h-4" /> Offen für Kollabos
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : list.length === 0 ? (
        <p className="text-white/40 py-10">
          {(profiles ?? []).length === 0 ? 'Noch keine freigegebenen Profile. Gestalte deins unter «Ich».' : 'Niemand passt zu diesen Filtern.'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <Link key={p.id} href={`/artists/${p.handle}`} className="group p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-primary/50 transition-colors flex gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center border-2 border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.avatarUrl ? <img src={p.avatarUrl} alt={p.artistName} className="w-full h-full object-cover" /> : <span className="text-2xl font-black italic text-gradient">{p.artistName.charAt(0)}</span>}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <h2 className="font-black uppercase italic tracking-tighter text-lg leading-tight truncate group-hover:text-primary transition-colors">{p.artistName}</h2>
                  {p.schoolName && <p className="text-xs text-white/40 truncate">{p.schoolName}</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.roles.slice(0, 3).map((r) => <span key={r} className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[11px] font-bold">{r}</span>)}
                  {p.genres.slice(0, 2).map((g) => <span key={g} className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[11px] font-bold">{g}</span>)}
                </div>
                {p.openForCollab && <p className="text-xs text-[#00E676] flex items-center gap-1"><Handshake className="w-3.5 h-3.5" /> Offen für Kollabos</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
