
"use client";
import { isSuperAdmin } from '@/lib/game/types';

import React, { useState } from 'react';
import { Article, ArticleProgress, LearnQuiz, getAccuracyColor } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Play,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
  Zap,
  Check,
  Music,
  Mic,
  Scissors,
  Layers,
  Sparkles,
  Sliders,
  Share2,
  Gamepad2,
  BookCheck
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { submitResult } from '@/lib/credits';

interface ArticleViewProps { article: Article; }
const PHASE_ICONS: Record<string, any> = { 'COMPOSING': Music, 'RECORDING': Mic, 'EDITING': Scissors, 'ARRANGEMENT': Layers, 'SOUNDDESIGN': Sparkles, 'MIXING / MASTERING': Sliders };

export const ArticleView: React.FC<ArticleViewProps> = ({ article }) => {
  const db = useFirestore();
  const { user, profile } = useUser();
  const { toast } = useToast();
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  const quizRef = useMemoFirebase(() => db ? doc(db, 'learnQuizzes', article.id) : null, [db, article.id]);
  const { data: quizData, isLoading: isLoadingQuiz } = useDoc<LearnQuiz>(quizRef);
  const progressRef = useMemoFirebase(() => db && user ? doc(db, 'users', user.uid, 'articleProgress', article.id) : null, [db, user, article.id]);
  const { data: progress } = useDoc<ArticleProgress>(progressRef);
  const hasQuiz = !!quizData?.questions?.length;
  const courseHref = `/learn/${article.courseId ?? 'producing'}`;
  const [markingRead, setMarkingRead] = useState(false);

  const handleMarkRead = async () => {
    if (!user) {
      toast({ title: "Bitte einloggen", description: "Nur eingeloggt wird dein Fortschritt gespeichert." });
      return;
    }
    setMarkingRead(true);
    const result = await submitResult(user, { kind: 'article', refId: article.id, answers: [] });
    setMarkingRead(false);
    if (!result) {
      toast({ variant: "destructive", title: "Speichern fehlgeschlagen" });
      return;
    }
    toast({ title: "Lektion abgeschlossen", description: result.awarded ? `+${result.awarded} Credits` : undefined });
  };

  const handleQuizSubmit = async () => {
    if (!quizData?.questions) return;
    const answers = quizData.questions.map((_, idx) => selectedOptions[idx] ?? null);
    if (!user) {
      toast({ title: "Bitte einloggen", description: "Nur eingeloggt werden Resultate gespeichert." });
      return;
    }
    const result = await submitResult(user, { kind: 'article', refId: article.id, answers });
    if (!result) {
      toast({ variant: "destructive", title: "Speichern fehlgeschlagen", description: "Bitte nochmals versuchen." });
      return;
    }
    setQuizScore(result.score);
    setQuizFinished(true);
  };

  const handleShareInvite = () => {
    const inviteLink = `${window.location.origin}/?invite=${article.id}`;
    navigator.clipboard.writeText(inviteLink);
    toast({ title: "Invite Link Copied", description: "This article is now assigned and ready to share." });
  };

  const parseInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-black text-white">{part.slice(2, -2)}</strong>;
      return part;
    });
  };

  const getYouTubeEmbedUrl = (url: string) => { const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/); return match ? `https://www.youtube.com/embed/${match[1]}` : null; };

  const renderLine = (line: string, idx: number) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} className="h-4" />;
    if (trimmed.startsWith('GAP:')) return <div key={idx} style={{ height: `${parseInt(trimmed.replace('GAP:', '').trim()) || 20}px` }} />;
    if (trimmed === '---') return <div key={idx} className="h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent my-10" />;
    if (trimmed.startsWith('VIDEO:')) return <div key={idx} className="mb-8"><div className="relative aspect-[9/16] max-w-[280px] mx-auto bg-black rounded-[2rem] border-4 border-white/10 overflow-hidden shadow-2xl"><video src={trimmed.replace('VIDEO:', '').trim()} controls className="w-full h-full object-cover" playsInline /></div></div>;
    if (trimmed.startsWith('GAME:')) {
      const [appId, label] = trimmed.replace('GAME:', '').split('|').map((p) => p.trim());
      return <Link key={idx} href={`/session/${appId}`} className="mb-8 flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-primary/30 hover:bg-white/10 transition-colors"><div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0"><Gamepad2 className="w-6 h-6 text-primary" /></div><div className="flex-1"><p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Übung</p><p className="font-black text-lg">{label || 'Minigame starten'}</p></div><Play className="w-5 h-5 text-white/60" /></Link>;
    }
    if (trimmed.startsWith('IMAGE:')) return <div key={idx} className="mb-8"><div className="relative w-full rounded-3xl overflow-hidden border border-white/10 shadow-lg bg-white/5"><img src={trimmed.replace('IMAGE:', '').trim()} alt="Content" className="w-full h-auto block" /></div></div>;
    if (trimmed.startsWith('###') || trimmed.startsWith('SUB:')) return <div key={idx} className="mb-4 mt-2"><span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary italic leading-none">{parseInlineFormatting(trimmed.replace(/^###\s*|^SUB:\s*/, ''))}</span></div>;
    if (trimmed.startsWith('##')) return <h4 key={idx} className="text-xl md:text-2xl font-bold tracking-tight text-white/95 mb-6 mt-4 leading-tight">{parseInlineFormatting(trimmed.replace(/^##\s*/, ''))}</h4>;
    if (trimmed.startsWith('#')) return <h3 key={idx} className="text-2xl md:text-4xl font-bold tracking-tight text-white mb-8 border-b border-white/10 pb-4 mt-6 leading-none">{parseInlineFormatting(trimmed.replace(/^#\s*/, ''))}</h3>;
    return <p key={idx} className="text-base md:text-lg text-white/80 leading-relaxed font-normal mb-6 selection:bg-primary/30 whitespace-pre-line">{parseInlineFormatting(line)}</p>;
  };

  const renderContent = (content: string) => {
    if (!content) return null;
    return content.split('\n\n').map((block, bIdx) => {
      const trimmed = block.trim();
      if (trimmed.startsWith('PHASE:')) {
        const parts = trimmed.replace('PHASE:', '').split('|');
        const title = parts[0]?.trim() || '', desc = parts[1]?.trim() || '', linkedId = parts[2]?.trim();
        const Icon = PHASE_ICONS[title.split(':')[0].trim()] || Play;
        return (
          <section key={bIdx} className="mb-14 border-t border-white/10 pt-8">
            <div className="flex items-center gap-5 mb-8"><div className="w-14 h-14 shrink-0 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10"><Icon className="w-7 h-7 text-primary" /></div><h4 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white leading-none">{title}</h4></div>
            <div className="mb-2">{desc.split('\n').map((l, lIdx) => renderLine(l, bIdx * 100 + lIdx))}</div>
            {linkedId && <Link href={`/learn/article/${linkedId}`}><Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 rounded-full px-8 italic font-black uppercase text-xs h-12 mt-6 tracking-widest">Learn More <ArrowRight className="ml-2 w-4 h-4" /></Button></Link>}
          </section>
        );
      }
      return <div key={bIdx} className="mb-2">{trimmed.split('\n').map((l, lIdx) => renderLine(l, bIdx * 100 + lIdx))}</div>;
    });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary font-body overflow-x-hidden">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 p-4 md:p-6"><div className="max-w-4xl mx-auto flex items-center justify-between gap-4"><div className="flex items-center gap-4"><Link href={courseHref}><Button variant="ghost" size="icon" className="rounded-full hover:bg-white/5"><ArrowLeft className="w-5 h-5 text-white/40" /></Button></Link>
        <div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic">Lektion</span><h1 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none pr-8 truncate max-w-[200px] md:max-w-md">{article.title}</h1></div>
      </div>
      {isSuperAdmin(profile?.role) && (
        <Button onClick={handleShareInvite} className="bg-primary text-white font-black uppercase italic rounded-full px-6 h-10 text-[10px] flex items-center gap-2 hover:scale-105 transition-all"><Share2 className="w-4 h-4" /> Invite & Assign</Button>
      )}
      </div></header>

      <main className="max-w-3xl mx-auto px-6 py-10 md:px-10 md:py-16 space-y-16 pb-48">
        <section className="max-w-2xl mx-auto">{renderContent(article.content)}</section>
        {article.youtubeUrls?.map((url, idx) => { const embedUrl = getYouTubeEmbedUrl(url); return embedUrl ? <div key={idx} className="max-w-2xl mx-auto"><div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black"><iframe src={embedUrl} title={`YouTube video ${idx + 1}`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div></div> : null; })}
        {!isLoadingQuiz && !hasQuiz && (
          <section className="max-w-2xl mx-auto">
            {progress?.completed ? (
              <p className="flex items-center justify-center gap-2 text-[#00E676] font-black uppercase tracking-widest text-sm"><BookCheck className="w-5 h-5" /> Lektion abgeschlossen</p>
            ) : (
              <Button onClick={handleMarkRead} disabled={markingRead} className="w-full h-16 bg-white text-black font-black uppercase italic rounded-[2rem] text-lg"><BookCheck className="w-5 h-5 mr-2" /> Als gelesen markieren</Button>
            )}
          </section>
        )}
        {hasQuiz && quizData && (
          <section className="gemini-border-primary"><div className="p-8 md:p-14 bg-black/60 rounded-[3rem] backdrop-blur-3xl shadow-2xl">
            <div className="flex items-center gap-4 mb-12"><HelpCircle className="w-8 h-8 text-primary" /><h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter">Wissens-Check</h3></div>
            {!quizFinished ? (
              <div className="space-y-12">{quizData.questions.map((q, idx) => (<div key={idx} className="space-y-6"><p className="text-lg font-bold leading-snug">{(idx + 1)}. {q.question}</p>
                <div className="grid gap-4">{q.options.map((opt, oIdx) => (<Button key={oIdx} variant="outline" onClick={() => setSelectedOptions({ ...selectedOptions, [idx]: oIdx })} className={cn("justify-start h-auto min-h-[4rem] px-8 py-4 rounded-2xl border-white/10 text-left whitespace-normal text-base font-medium", selectedOptions[idx] === oIdx ? "bg-primary text-white shadow-lg" : "bg-white/5 hover:bg-white/10")}>{opt}</Button>))}</div></div>))}
                <Button onClick={handleQuizSubmit} className="w-full h-20 bg-white text-black font-black uppercase italic rounded-[2rem] text-xl shadow-xl">Auswerten</Button>
              </div>
            ) : (
              <div className="text-center space-y-10 animate-in zoom-in-95"><div className="inline-block relative"><CheckCircle2 className="w-24 h-24 mx-auto" style={{ color: getAccuracyColor(quizScore) }} /><Zap className="absolute -top-2 -right-2 w-10 h-10 text-[#FFEA00] animate-pulse" fill="currentColor" /></div>
                <div><h4 className="text-6xl font-black italic tracking-tighter" style={{ color: getAccuracyColor(quizScore) }}>{quizScore}%</h4><p className="text-sm uppercase font-black opacity-40 mt-4">Ergebnis</p></div>
                {quizScore >= 80 ? <div className="bg-[#00E676]/10 border border-[#00E676]/20 p-6 rounded-2xl text-[#00E676] text-sm font-black uppercase tracking-widest animate-pulse">Bestanden – Credits erhalten</div> : <Button onClick={() => { setQuizFinished(false); setSelectedOptions({}); }} variant="outline" className="h-16 px-10 rounded-2xl font-black uppercase italic border-white/20">Nochmals versuchen</Button>}
              </div>
            )}
          </div></section>
        )}
      </main>
      <footer className="fixed bottom-0 w-full p-8 flex justify-center z-[60] pointer-events-none"><Link href={courseHref} className="pointer-events-auto"><Button className="h-16 px-14 bg-primary text-white font-black uppercase italic rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all"><Check className="mr-3 h-6 w-6" /> Zurück zum Kurs</Button></Link></footer>
    </div>
  );
};
