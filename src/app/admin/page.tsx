'use client';

import Link from 'next/link';
import { useUser } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function AdminPage() {
  const { profile, isUserLoading } = useUser();

  if (isUserLoading) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (profile?.role !== 'admin') return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center"><p className="font-bold">Access denied.</p></div>;

  return <main className="min-h-screen bg-[#050505] text-white p-6 md:p-10"><div className="max-w-6xl mx-auto"><Link href="/"><Button variant="ghost" className="mb-8"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button></Link><div className="flex items-center gap-4"><ShieldCheck className="w-10 h-10 text-primary" /><div><p className="text-xs uppercase tracking-[0.3em] text-primary font-bold">BeatHero Admin</p><h1 className="text-3xl md:text-5xl font-bold tracking-tight">Learn CMS</h1></div></div></div></main>;
}
