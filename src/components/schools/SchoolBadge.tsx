import React from 'react';
import Link from 'next/link';
import { School as SchoolIcon } from 'lucide-react';
import type { School } from '@/lib/game/types';
import { cn } from '@/lib/utils';

/** Logo einer Schule (oder Initialen), rund auf hellem Grund. */
export function SchoolLogo({ school, size = 40, className }: { school: Pick<School, 'name' | 'logoUrl'>; size?: number; className?: string }) {
  const initials = school.name.split(/\s+/).filter((w) => w.length > 2 || /^[A-ZÄÖÜ]/.test(w)).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className={cn('inline-flex items-center justify-center rounded-xl bg-white overflow-hidden shrink-0', className)}
      style={{ width: size, height: size }} title={school.name}>
      {school.logoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={school.logoUrl} alt={school.name} className="w-full h-full object-contain p-1" />
        : initials ? <span className="font-bold text-black/70" style={{ fontSize: size * 0.36 }}>{initials}</span>
          : <SchoolIcon className="text-black/60" style={{ width: size * 0.5, height: size * 0.5 }} />}
    </span>
  );
}

/** Logo + Name, verlinkt auf die Schulseite. */
export function SchoolBadge({ school, compact }: { school: School; compact?: boolean }) {
  return (
    <Link href={`/schools/${school.id}`}
      className="inline-flex items-center gap-2 pr-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/30 transition-colors">
      <SchoolLogo school={school} size={compact ? 28 : 36} />
      <span className={cn('font-medium text-white/85', compact ? 'text-xs' : 'text-sm')}>{school.name}</span>
    </Link>
  );
}
