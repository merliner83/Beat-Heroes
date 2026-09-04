
"use client";

import React, { useState } from 'react';
import { Article, LearnQuiz, getAccuracyColor } from '@/lib/game/types';
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
  Share2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, setDoc, serverTimestamp, increment, getDoc } from 'firebase/firestore';

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
  const { data: quizData } = useDoc<LearnQuiz>(quizRef);

  const handleQuizSubmit = async () => {
    if (!quizData?.questions) return;
    let correct = 0;
    quizData.questions.forEach((q, idx) => { if (selectedOptions[idx] === q.correctOption) correct++; });
    const score = Math.round((correct / quizData.questions.length) * 100);
    setQuizScore(score);
    setQuizFinished(true);

    if (user && db) {
      const progRef = doc(db, 'users', user.uid, 'articleProgress', article.id);
      const snap = await getDoc(progRef);
      const oldScore = snap.exists() ? (snap.data().quizScore || 0) : 0;

      if (score > oldScore) {
        await setDoc(progRef, { articleId: article.id, completed: true, quizScore: score, completedAt: serverTimestamp() }, { merge: true });
        const deltaAcc = score - oldScore;
        const deltaSC = Math.round((deltaAcc / 100) * (article.maxPoints || 250));
        await setDoc(doc(db, 'users', user.uid), { streetCred: increment(deltaSC) }, { merge: true });
      }
    }
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

  const renderLine = (line: string, idx: number) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} className="h-4" />;
    if (trimmed.startsWith('GAP:')) return <div key={idx} style={{ height: `${parseInt(trimmed.replace('GAP:', '').trim()) || 20}px` }} />;
    if (trimmed === '---') return <div key={idx} className="h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent my-10" />;
    if (trimmed.startsWith('VIDEO:')) return <div key={idx} className="mb-8"><div className="relative aspect-[9/16] max-w-[280px] mx-auto bg-black rounded-[2rem] border-4 border-white/10 overflow-hidden shadow-2xl"><video src={trimmed.replace('VIDEO:', '').trim()} controls className="w-full h-full object-cover" playsInline /></div></div>;
    if (trimmed.startsWith('IMAGE:')) return <div key={idx} className="mb-8"><div className="relative w-full rounded-3xl overflow-hidden border border-white/10 shadow-lg bg-white/5"><img src={trimmed.replace('IMAGE:', '').trim()} alt="Content" className="w-full h-auto block" /></div></div>;
    if (trimmed.startsWith('###') || trimmed.startsWith('SUB:')) return <div key={idx} className="mb-4 mt-2"><span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary italic leading-none">{parseInlineFormatting(trimmed.replace(/^###\s*|^SUB:\s*/, ''))}</span></div>;
    if (trimmed.startsWith('##')) return <h4 key={idx} className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white/95 mb-6 mt-4 leading-tight">{parseInlineFormatting(trimmed.replace(/^##\s*/, ''))}</h4>;
    if (trimmed.startsWith('#')) return <h3 key={idx} className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter text-white mb-8 border-b border-white/10 pb-4 mt-6 leading-none">{parseInlineFormatting(trimmed.replace(/^#\s*/, ''))}</h3>;
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
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 p-4 md:p-6"><div className="max-w-4xl mx-auto flex items-center justify-between gap-4"><div className="flex items-center gap-4"><Link href="/"><Button variant="ghost" size="icon" className="rounded-full hover:bg-white/5"><ArrowLeft className="w-5 h-5 text-white/40" /></Button></Link>
        <div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic">KnowHow Lab</span><h1 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none pr-8 truncate max-w-[200px] md:max-w-md">{article.title}</h1></div>
      </div>
      {profile?.role === 'admin' && (
        <Button onClick={handleShareInvite} className="bg-primary text-white font-black uppercase italic rounded-full px-6 h-10 text-[10px] flex items-center gap-2 hover:scale-105 transition-all"><Share2 className="w-4 h-4" /> Invite & Assign</Button>
      )}
      </div></header>

      <main className="max-w-3xl mx-auto px-6 py-10 md:px-10 md:py-16 space-y-16 pb-48">
        <section className="max-w-2xl mx-auto">{renderContent(article.content)}</section>
        {quizData?.questions?.length && (
          <section className="gemini-border-primary"><div className="p-8 md:p-14 bg-black/60 rounded-[3rem] backdrop-blur-3xl shadow-2xl">
            <div className="flex items-center gap-4 mb-12"><HelpCircle className="w-8 h-8 text-primary" /><h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter">Knowledge Check</h3></div>
            {!quizFinished ? (
              <div className="space-y-12">{quizData.questions.map((q, idx) => (<div key={idx} className="space-y-6"><p className="text-lg font-bold leading-snug">{(idx + 1)}. {q.question}</p>
                <div className="grid gap-4">{q.options.map((opt, oIdx) => (<Button key={oIdx} variant="outline" onClick={() => setSelectedOptions({ ...selectedOptions, [idx]: oIdx })} className={cn("justify-start h-auto min-h-[4rem] px-8 py-4 rounded-2xl border-white/10 text-left whitespace-normal text-base font-medium", selectedOptions[idx] === oIdx ? "bg-primary text-white shadow-lg" : "bg-white/5 hover:bg-white/10")}>{opt}</Button>))}</div></div>))}
                <Button onClick={handleQuizSubmit} className="w-full h-20 bg-white text-black font-black uppercase italic rounded-[2rem] text-xl shadow-xl">Submit Quiz</Button>
              </div>
            ) : (
              <div className="text-center space-y-10 animate-in zoom-in-95"><div className="inline-block relative"><CheckCircle2 className="w-24 h-24 mx-auto" style={{ color: getAccuracyColor(quizScore) }} /><Zap className="absolute -top-2 -right-2 w-10 h-10 text-[#FFEA00] animate-pulse" fill="currentColor" /></div>
                <div><h4 className="text-6xl font-black italic tracking-tighter" style={{ color: getAccuracyColor(quizScore) }}>{quizScore}%</h4><p className="text-sm uppercase font-black opacity-40 mt-4">Sync Grade</p></div>
                {quizScore >= 80 ? <div className="bg-[#00E676]/10 border border-[#00E676]/20 p-6 rounded-2xl text-[#00E676] text-sm font-black uppercase tracking-widest animate-pulse">Street Cred Earned</div> : <Button onClick={() => { setQuizFinished(false); setSelectedOptions({}); }} variant="outline" className="h-16 px-10 rounded-2xl font-black uppercase italic border-white/20">Retry Attempt</Button>}
              </div>
            )}
          </div></section>
        )}
      </main>
      <footer className="fixed bottom-0 w-full p-8 flex justify-center z-[60] pointer-events-none"><Link href="/" className="pointer-events-auto"><Button className="h-16 px-14 bg-primary text-white font-black uppercase italic rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all"><Check className="mr-3 h-6 w-6" /> Got it, Lab!</Button></Link></footer>
    </div>
  );
};
