import { cn } from '@/lib/utils';

/** Stufe eines Themas (Kapitels) aus bestandenen Lektionen – ohne eigene Daten, nur abgeleitet. */
export function topicLevel(done: number, total: number) {
  if (total === 0 || done === 0) return { label: 'Neu', className: 'text-white/60' };
  if (done >= total) return { label: 'Gemeistert', className: 'text-success' };
  return { label: 'Am Lernen', className: 'text-warning' };
}

/**
 * Ein Segment pro Lektion: grün = bestanden, Akzent = aktuelle Lektion, grau = offen.
 * Bei sehr vielen Lektionen wird daraus ein durchgehender Balken.
 */
export function TopicProgress({ passed, currentIndex, accent, className }: {
  passed: boolean[]; currentIndex?: number; accent?: string; className?: string;
}) {
  const total = passed.length;
  if (total === 0) return null;
  if (total > 12) {
    const done = passed.filter(Boolean).length;
    return (
      <div className={cn('h-1.5 rounded-full bg-white/10 overflow-hidden', className)}>
        <div className="h-full bg-success rounded-full" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    );
  }
  return (
    <div className={cn('flex gap-1', className)} role="img" aria-label={`${passed.filter(Boolean).length} von ${total} Lektionen bestanden`}>
      {passed.map((p, i) => (
        <span key={i} className={cn('h-1.5 flex-1 rounded-full', p ? 'bg-success' : 'bg-white/10')}
          style={!p && i === currentIndex ? { background: accent ?? 'hsl(var(--primary))' } : undefined} />
      ))}
    </div>
  );
}
