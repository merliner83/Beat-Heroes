/**
 * Beat-Heroes-Bausteine (Design-System). Neue Seiten bauen hierauf auf,
 * damit Abstände, Typografie und Farben überall gleich sind.
 *
 * Farben: brand (Pink), success, warning, credit (Credits), info, violet –
 * als Tailwind-Farben, z.B. `text-success`, `bg-brand/20`.
 * Typografie: `.h-display` nur für Titel, `.eyebrow` für kleine Labels.
 */
import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

export function PageHeader({ title, subtitle, back, actions, gradient = true }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  gradient?: boolean;
}) {
  return (
    <header className="space-y-3">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <h1 className={cn('h-display text-3xl md:text-5xl', gradient && 'text-gradient')}>{title}</h1>
          {subtitle && <p className="text-white/70 max-w-2xl">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ icon: Icon, children, action }: { icon?: IconType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-bold text-white/90">
        {Icon && <Icon className="w-5 h-5 text-brand" />} {children}
      </h2>
      {action}
    </div>
  );
}

export function Panel({ className, hover, ...props }: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return <div className={cn('panel', hover && 'panel-hover', className)} {...props} />;
}

export function Chip({ active, onClick, children, tone = 'brand', className }: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  tone?: 'brand' | 'success';
  className?: string;
}) {
  const on = tone === 'success' ? 'bg-success border-success text-black' : 'bg-brand border-brand text-white';
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn('inline-flex items-center gap-1 px-3 h-8 rounded-full text-sm font-medium border transition-colors',
        active ? on : 'border-white/15 text-white/70 hover:text-white hover:border-white/30', className)}>
      {children}
    </button>
  );
}

export function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'brand' | 'success' | 'warning' }) {
  const cls = {
    neutral: 'bg-white/10 text-white/75',
    brand: 'bg-brand/20 text-brand',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
  }[tone];
  return <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', cls)}>{children}</span>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-white/60 p-6 rounded-2xl border border-dashed border-white/15">{children}</p>;
}

export function Loading({ className }: { className?: string }) {
  return (
    <div className={cn('h-64 flex items-center justify-center', className)} role="status" aria-label="Lädt">
      <Loader2 className="w-10 h-10 animate-spin text-brand" />
    </div>
  );
}
