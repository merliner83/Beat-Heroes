
"use client";

import React, { useState } from 'react';
import { Article, LearnQuiz, getAccuracyColor } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Image as ImageIcon, 
  Music, 
  Mic, 
  Scissors, 
  Layers, 
  Sliders, 
  Play,
  Sparkles,
  ArrowRight,
  Youtube,
  HelpCircle,
  CheckCircle2,
  Zap,
  Check
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';

interface ArticleViewProps {
  article: Article;
}

const PHASE_ICONS: Record<string, any> = {
  'COMPOSING': Music,
  'RECORDING': Mic,
  'EDITING': Scissors,
  'ARRANGEMENT': Layers,
  'SOUNDDESIGN': Sparkles,
  'MIXING / MASTERING': Sliders,
};

export const ArticleView: React.FC<ArticleViewProps> = ({ article }) => {
  const db = useFirestore();
  const { user } = useUser();
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  const quizRef = useMemoFirebase(() => {
    if (!db || !article.id) return null;
    return doc(db, 'learnQuizzes', article.id);
  }, [db, article.id]);

  const { data: quizData } = useDoc<LearnQuiz>(quizRef);

  const handleQuizSubmit = () => {
    if (!quizData || !quizData.questions) return;
    let correct = 0;
    quizData.questions.forEach((q, idx) => {
      if (selectedOptions[idx] === q.correctOption) correct++;
    });
    const score = Math.round((correct / quizData.questions.length) * 100);
    setQuizScore(score);
    setQuizFinished(true);

    if (user && db) {
      setDoc(doc(db, 'users', user.uid, 'articleProgress', article.id), {
        articleId: article.id,
        completed: true,
        quizScore: score,
        completedAt: serverTimestamp()
      }, { merge: true });
      
      if (score >= 80) {
        setDoc(doc(db, 'users', user.uid), { streetCred: increment(250) }, { merge: true });
      }
    }
  };

  const getYoutubeId = (url: string) => {
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const renderContent = (content: string) => {
    const blocks = content.split('\n\n');
    return blocks.map((block, idx) => {
      const trimmedBlock = block.trim();

      // --- PHASE BLOCKS ---
      if (trimmedBlock.startsWith('PHASE:')) {
        const parts = trimmedBlock.replace('PHASE:', '').split('|');
        const displayMainTitle = parts[0]?.trim() || '';
        const description = parts[1]?.trim() || '';
        const linkedArticleId = parts[2]?.trim();
        const Icon = PHASE_ICONS[displayMainTitle] || Play;

        const videoMatches = description.match(/VIDEO:(\S+)/g) || [];
        const youtubeMatches = description.match(/YOUTUBE:(\S+)/g) || [];
        const imageMatches = description.match(/IMAGE:(\S+)/g) || [];

        const cleanDescription = description
          .replace(/VIDEO:\S+/g, '')
          .replace(/YOUTUBE:\S+/g, '')
          .replace(/IMAGE:\S+/g, '')
          .trim();

        return (
          <div key={idx} className="mb-8 gemini-border animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="p-8 bg-black/40 backdrop-blur-xl">
              <div className="flex items-center gap-5 mb-6">
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <h4 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white leading-none">
                  {displayMainTitle}
                </h4>
              </div>
              
              {cleanDescription && (
                <p className="text-base md:text-xl text-white/60 leading-relaxed font-normal mb-8 whitespace-pre-line">{cleanDescription}</p>
              )}

              <div className="space-y-6 mb-6">
                {videoMatches.map((m, i) => (
                  <div key={i} className="relative aspect-[9/16] max-w-[240px] mx-auto rounded-2xl border-4 border-white/10 overflow-hidden shadow-2xl">
                     <video src={m.replace('VIDEO:', '')} controls className="w-full h-full object-cover" />
                  </div>
                ))}
                {youtubeMatches.map((m, i) => {
                  const vidId = getYoutubeId(m.replace('YOUTUBE:', ''));
                  if (!vidId) return null;
                  return (
                    <div key={i} className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                      <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${vidId}`} frameBorder="0" allowFullScreen></iframe>
                    </div>
                  );
                })}
                {imageMatches.map((m, i) => (
                  <div key={i} className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-lg">
                    <Image src={m.replace('IMAGE:', '')} alt="Phase Media" fill className="object-cover" sizes="600px" />
                  </div>
                ))}
              </div>
              
              {linkedArticleId && (
                <Link href={`/learn/article/${linkedArticleId}`}>
                  <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 rounded-full px-6 italic font-black uppercase text-xs h-10 mt-4">
                    Learn More <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        );
      }

      // --- FLEXIBLE GAP ---
      if (trimmedBlock.startsWith('GAP:')) {
        const height = parseInt(trimmedBlock.replace('GAP:', '').trim(), 10) || 20;
        return <div key={idx} style={{ height: `${height}px` }} />;
      }

      // --- SEPARATOR ---
      if (trimmedBlock === '---') {
        return <div key={idx} className="h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent my-10" />;
      }

      // --- INLINE VIDEO (9:16) ---
      if (trimmedBlock.startsWith('VIDEO:')) {
        return (
          <div key={idx} className="mb-12 animate-in fade-in slide-in-from-top-6 duration-700">
            <div className="relative aspect-[9/16] max-w-[320px] mx-auto bg-black rounded-[2.5rem] border-8 border-white/10 overflow-hidden shadow-2xl">
              <video src={trimmedBlock.replace('VIDEO:', '').trim()} controls className="w-full h-full object-cover" playsInline />
            </div>
          </div>
        );
      }

      // --- INLINE YOUTUBE ---
      if (trimmedBlock.startsWith('YOUTUBE:')) {
        const vidId = getYoutubeId(trimmedBlock.replace('YOUTUBE:', '').trim());
        if (!vidId) return null;
        return (
          <div key={idx} className="mb-12 animate-in fade-in zoom-in-95 duration-500">
            <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 bg-black shadow-xl">
              <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${vidId}`} frameBorder="0" allowFullScreen></iframe>
            </div>
          </div>
        );
      }

      // --- INLINE IMAGE ---
      if (trimmedBlock.startsWith('IMAGE:')) {
        return (
          <div key={idx} className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-lg">
              <Image src={trimmedBlock.replace('IMAGE:', '').trim()} alt="Article Image" fill className="object-cover" sizes="(max-width: 768px) 100vw, 800px" />
            </div>
          </div>
        );
      }

      // --- TINY SUBTITLE / LABEL (### or SUB:) ---
      if (trimmedBlock.startsWith('###') || trimmedBlock.startsWith('SUB:')) {
        const content = trimmedBlock.replace(/^###\s*|^SUB:\s*/, '');
        return (
          <div key={idx} className="mb-4 mt-2">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-primary/70 italic">
              {content}
            </span>
          </div>
        );
      }
      
      // --- SUB-HEADLINES (##) ---
      if (trimmedBlock.startsWith('##')) {
        const content = trimmedBlock.replace(/^##\s*/, '');
        return (
          <div key={idx} className="mb-6 mt-2">
            <h4 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-white/90">
              {content}
            </h4>
          </div>
        );
      }

      // --- MAIN HEADLINES (#) ---
      if (trimmedBlock.startsWith('#')) {
        const content = trimmedBlock.replace(/^#\s*/, '');
        return (
          <div key={idx} className="mb-10">
            <h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white mb-6 border-b border-white/5 pb-2">
              {content}
            </h3>
          </div>
        );
      }

      // --- DEFAULT TEXT ---
      return (
        <div key={idx} className="mb-12">
          <p className="text-lg md:text-xl text-white/60 leading-relaxed font-normal whitespace-pre-line">{trimmedBlock}</p>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary font-body">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }} />
      
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 p-4 md:p-6">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/5"><ArrowLeft className="w-5 h-5 text-white/40" /></Button>
          </Link>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic">KnowHow Lab</span>
            <h1 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none pr-8 truncate max-w-[250px] md:max-w-md">{article.title}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-16 space-y-16 pb-48">
        <section className="bg-white/2 border border-white/5 p-8 md:p-16 rounded-[3rem] backdrop-blur-sm">
          {renderContent(article.content)}
        </section>

        {article.imageUrls && article.imageUrls.length > 0 && (
          <section className="space-y-8">
            <div className="flex items-center gap-3"><ImageIcon className="w-5 h-5 text-[#00E676]" /><h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/30 italic">Reference Gallery</h3></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {article.imageUrls.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-white/5 bg-black/40">
                  <Image src={url} alt="Reference" fill className="object-cover" sizes="(max-width: 768px) 50vw, 300px" />
                </div>
              ))}
            </div>
          </section>
        )}

        {article.youtubeUrls && article.youtubeUrls.length > 0 && (
          <section className="space-y-8">
            <div className="flex items-center gap-3 justify-center"><Youtube className="w-5 h-5 text-red-500" /><h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/30 italic">YouTube Archive</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {article.youtubeUrls.map((url, i) => {
                const vidId = getYoutubeId(url);
                if (!vidId) return null;
                return (
                  <div key={i} className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 bg-black">
                    <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${vidId}`} frameBorder="0" allowFullScreen></iframe>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {quizData && quizData.questions && quizData.questions.length > 0 && (
          <section className="gemini-border-primary">
            <div className="p-8 md:p-12 bg-black/60 rounded-[3rem]">
              <div className="flex items-center gap-3 mb-10"><HelpCircle className="w-6 h-6 text-primary" /><h3 className="text-xl font-black uppercase italic tracking-tighter">Knowledge Check</h3></div>
              {!quizFinished ? (
                <div className="space-y-10">
                  {quizData.questions.map((q, idx) => (
                    <div key={idx} className="space-y-4">
                      <p className="text-lg font-bold">{(idx + 1)}. {q.question}</p>
                      <div className="grid gap-3">
                        {q.options.map((opt, oIdx) => (
                          <Button 
                            key={oIdx} 
                            variant="outline" 
                            onClick={() => setSelectedOptions({ ...selectedOptions, [idx]: oIdx })}
                            className={cn(
                              "justify-start h-14 px-6 rounded-xl border-white/5 text-left whitespace-normal",
                              selectedOptions[idx] === oIdx ? "bg-primary/20 border-primary text-primary" : "bg-white/5"
                            )}
                          >
                            {opt}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button onClick={handleQuizSubmit} className="w-full h-16 bg-white text-black font-black uppercase italic rounded-2xl">Submit Quiz</Button>
                </div>
              ) : (
                <div className="text-center space-y-8 animate-in zoom-in-95">
                  <div className="inline-block relative">
                    <CheckCircle2 className="w-20 h-20 mx-auto" style={{ color: getAccuracyColor(quizScore) }} />
                    <Zap className="absolute -top-2 -right-2 w-8 h-8 text-[#FFEA00] animate-pulse" fill="currentColor" />
                  </div>
                  <div>
                    <h4 className="text-5xl font-black italic tracking-tighter" style={{ color: getAccuracyColor(quizScore) }}>{quizScore}%</h4>
                    <p className="text-xs uppercase font-black tracking-widest opacity-40 mt-2">Sync Grade</p>
                  </div>
                  {quizScore >= 80 ? (
                    <div className="bg-[#00E676]/10 border border-[#00E676]/20 p-4 rounded-xl text-[#00E676] text-xs font-black uppercase tracking-widest">+250 Street Cred Unlocked</div>
                  ) : (
                    <Button onClick={() => { setQuizFinished(false); setSelectedOptions({}); }} variant="outline" className="h-14 px-8 rounded-xl font-black uppercase italic">Retry Attempt</Button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="fixed bottom-0 w-full p-6 flex justify-center z-[60] pointer-events-none">
        <Link href="/" className="pointer-events-auto">
          <Button className="h-16 px-12 bg-primary hover:bg-primary/90 text-white font-black uppercase italic rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all">
            <Check className="mr-2 h-5 w-5" /> Got it, Lab!
          </Button>
        </Link>
      </footer>
    </div>
  );
};
