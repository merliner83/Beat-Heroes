'use client';

import Link from 'next/link';
import Image from 'next/image';
import { collection, query } from 'firebase/firestore';
import { Loader2, Lock } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Studio, hasAccess } from '@/lib/game/types';
import { cn } from '@/lib/utils';

function StudioCard({ studio, isLocked }: { studio: Studio; isLocked: boolean }) {
  return (
    <div className={cn(
      'relative group overflow-hidden rounded-lg border border-white/5 bg-black/40 hover:border-primary/50 shadow-2xl aspect-square w-full transition-all duration-500',
      isLocked && 'opacity-60 grayscale-[0.5]',
    )}>
      <div className="absolute inset-0 overflow-hidden">
        {studio.imageUrl ? (
          <Image src={studio.imageUrl} alt={studio.name} fill className="object-cover group-hover:scale-110 transition-all duration-1000" sizes="(max-width: 640px) 50vw, 25vw" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: studio.coverColor }} />
        )}
      </div>
      {isLocked && <div className="absolute top-4 right-4 z-30 bg-black/60 backdrop-blur-md p-1.5 rounded-full border border-white/10"><Lock className="w-4 h-4 text-white/40" /></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
      <div className="absolute inset-0 p-4 flex flex-col justify-end items-center text-center z-20 pb-6">
        <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white group-hover:text-primary transition-colors leading-[0.85] drop-shadow-lg">{studio.name}</h3>
      </div>
    </div>
  );
}

export default function GamesPage() {
  const db = useFirestore();
  const { profile } = useUser();
  const studiosQuery = useMemoFirebase(() => (db ? query(collection(db, 'studios')) : null), [db]);
  const { data: studios, isLoading } = useCollection<Studio>(studiosQuery);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-gradient">Games</h1>
        <p className="text-white/50 mt-2">Wähle ein Studio und spiel dich durch die Levels.</p>
      </div>
      {isLoading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {studios?.map((s) => {
            const locked = !hasAccess(profile?.role, s.minRole);
            return (
              <Link key={s.id} href={locked ? '#' : `/studio/${s.id}`} className={cn('block transition-transform hover:scale-105', locked && 'cursor-not-allowed')}>
                <StudioCard studio={s} isLocked={locked} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
