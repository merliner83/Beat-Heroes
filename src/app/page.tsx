
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, setDoc, getDoc } from 'firebase/firestore';
import { Studio, Game, Article, Track, Sound, TriggerPattern, hasAccess } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import { cn } from '@/lib/utils';
import { Radio, RefreshCw, Loader2, Zap, Search, LayoutGrid, GraduationCap, Lock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LearnView } from '@/components/learn/LearnView';

const StudioCard = ({ studio, isLocked }: { studio: Studio; isLocked: boolean }) => (
  <div className={cn(
    "relative group cursor-pointer transition-all duration-500 overflow-hidden rounded-lg border border-white/5 bg-black/40 hover:border-primary/50 shadow-2xl aspect-square w-full",
    isLocked && "opacity-60 grayscale-[0.5]"
  )}>
    <div className="absolute inset-0 overflow-hidden">
      {studio.imageUrl ? (
        <Image
          src={studio.imageUrl}
          alt={studio.name}
          fill
          className="object-cover opacity-100 group-hover:scale-110 transition-all duration-1000"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      ) : (
        <div className="absolute inset-0 opacity-100" style={{ backgroundColor: studio.coverColor }} />
      )}
    </div>

    {isLocked && (
      <div className="absolute top-4 right-4 z-30 bg-black/60 backdrop-blur-md p-1.5 rounded-full border border-white/10">
        <Lock className="w-4 h-4 text-white/40" />
      </div>
    )}

    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
    
    <div className="absolute inset-0 p-4 flex flex-col justify-end items-center text-center z-20 pb-6">
      <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white group-hover:text-primary transition-colors leading-[0.85] break-words drop-shadow-lg">
        {studio.name}
      </h3>
    </div>
    
    <div 
      className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-1000 pointer-events-none z-0"
      style={{ backgroundColor: studio.coverColor }}
    />
  </div>
);

export default function HomePage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user, profile } = useUser();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [activeTab, setActiveTab] = useState('studios');

  useEffect(() => {
    const savedTab = localStorage.getItem('beathero_active_tab');
    if (savedTab === 'studios' || savedTab === 'learn') {
      setActiveTab(savedTab);
    }
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem('beathero_active_tab', value);
  };

  useEffect(() => {
    if (!user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, auth]);

  useEffect(() => {
    if (user && db) {
      const userRef = doc(db, 'users', user.uid);
      getDoc(userRef).then(snap => {
        if (!snap.exists()) {
          setDoc(userRef, { uid: user.uid, streetCred: 0, role: 'free' }, { merge: true });
        }
      });
    }
  }, [user, db]);

  const streetCred = profile?.streetCred || 0;

  const studiosQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'studios'));
  }, [db]);

  const { data: allStudios, isLoading: isLoadingStudios } = useCollection<Studio>(studiosQuery);

  const dynamicTags = useMemo(() => {
    if (!allStudios) return ['All'];
    const tagsSet = new Set<string>(['All']);
    allStudios.forEach(s => {
      s.tags?.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet);
  }, [allStudios]);

  const filteredStudios = useMemo(() => {
    if (!allStudios) return [];
    return allStudios.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           s.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag === 'All' || 
                        s.tags?.some(t => t.toLowerCase() === selectedTag.toLowerCase());
      return matchesSearch && matchesTag;
    });
  }, [allStudios, searchQuery, selectedTag]);

  const setupStudios = async () => {
    if (!db) return;
    try {
      // 1. Patterns
      await setDoc(doc(db, 'patterns', 'pattern-4onfloor'), {
        id: 'pattern-4onfloor',
        name: '4-on-the-Floor',
        steps: [0, 16, 32, 48, 64, 80, 96, 112]
      }, { merge: true });

      // 2. Studios
      const studios: Partial<Studio>[] = [
        { id: 'std-gabriel', name: 'Gabriel Beats', description: 'Handcrafted signature sounds.', coverColor: '#FF9100', district: 'Creative Hub', tags: ['Hip-Hop', 'Soul'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FGabriel%20Studio.png?alt=media&token=2f1e1b66-7f23-461b-9377-f738ea0ce79f' },
        { id: 'std-nintu', name: 'Nintu Music', description: 'Deep melodic explorations.', coverColor: '#993DEB', district: 'Melody District', tags: ['Melodic', 'Techno'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2Fstudioo.png?alt=media&token=9a547bdf-a3bf-4a9a-a132-222383e88b1f' },
        { id: 'std-yoan', name: 'Yoan Beats', description: 'Raw urban textures.', coverColor: '#3838FA', district: 'Underground', tags: ['Trap', 'Urban'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FYoan%20Beats.png?alt=media&token=984099f0-f45b-4836-81d0-35241d774d83' },
        { id: 'std-dave', name: 'Dave Beats', description: 'Experimental soundscapes.', coverColor: '#EB3D99', district: 'The Lab', tags: ['Glitch', 'Ambient'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2Fstudio%202.png?alt=media&token=96cb0afc-36e3-4c58-8e5d-45a68cd4673a' },
        { id: 'std-noxxos', name: 'Noxxos', description: 'Futuristic club anthems.', coverColor: '#FF3D00', district: 'Skyline', tags: ['Electro', 'House'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FNoxxos%20Studio.png?alt=media&token=fa9f78bc-965b-4af2-bfde-4f0383a87d98' }
      ];
      for (const s of studios) {
        await setDoc(doc(db, 'studios', s.id!), s, { merge: true });
      }

      // 3. Tracks for Gabriel Beats
      const gabrielTracks: Partial<Track>[] = [
        { id: 'tr-g1', studioId: 'std-gabriel', name: 'Track 1', author: 'Gabriel' },
        { id: 'tr-g2', studioId: 'std-gabriel', name: 'Track 2', author: 'Gabriel' },
        { id: 'tr-g3', studioId: 'std-gabriel', name: 'Track 3', author: 'Gabriel' },
        { id: 'tr-g4', studioId: 'std-gabriel', name: 'Track 4', author: 'Gabriel' },
        { id: 'tr-g5', studioId: 'std-gabriel', name: 'Track 5', author: 'Gabriel' }
      ];
      for (const t of gabrielTracks) {
        await setDoc(doc(db, 'tracks', t.id!), t, { merge: true });
      }

      // 4. Global Learn Games
      const globalGames: Partial<Game>[] = [
        { id: 'global-ear-training', studioId: 'learn-center', name: 'Ear Training', type: 'ear-training', difficulty: 1, minRole: 'free' },
        { id: 'global-rhythm-game', studioId: 'learn-center', name: 'Rhythm Master', type: 'rhythm-producer', difficulty: 1, minRole: 'admin' },
        { id: 'global-notation-pro', studioId: 'learn-center', name: 'Notation Pro', type: 'notation-pro', difficulty: 1, minRole: 'admin' },
      ];
      for (const g of globalGames) {
        await setDoc(doc(db, 'games', g.id!), g, { merge: true });
        const levelId = g.id === 'global-ear-training' ? 'global-ear-training' : `${g.id}-lvl1`;
        await setDoc(doc(db, 'levels', levelId), { id: levelId, gameId: g.id, difficulty: 1, name: 'Basics' }, { merge: true });
        if (g.type === 'rhythm-producer') {
          await setDoc(doc(db, 'levels', levelId, 'sounds', `${levelId}-kick`), { id: `${levelId}-kick`, levelId, type: 'kick', patternIds: ['pattern-4onfloor'], sampleUrl: '' }, { merge: true });
        }
      }

      // 5. Studio Games (3 per Studio, 4 Levels each)
      const gameConfigs = [
        { type: 'rhythm-producer' as const, name: 'Beat Hero' },
        { type: 'disk-dash' as const, name: 'Sample Catcher' },
        { type: 'sample-hunter' as const, name: 'Vinyl Hunter' }
      ];

      for (const s of studios) {
        for (const config of gameConfigs) {
          const gameId = `${s.id}-${config.type}`;
          await setDoc(doc(db, 'games', gameId), {
            id: gameId,
            studioId: s.id!,
            name: config.name,
            type: config.type,
            difficulty: 1,
            minRole: 'free',
            bpm: 120
          }, { merge: true });

          // 4 Levels per game
          for (let i = 1; i <= 4; i++) {
            const levelId = `${gameId}-lvl${i}`;
            await setDoc(doc(db, 'levels', levelId), {
              id: levelId,
              gameId: gameId,
              difficulty: i,
              name: `Level ${i}`
            }, { merge: true });

            if (config.type === 'rhythm-producer' || config.type === 'disk-dash' || config.type === 'sample-hunter') {
               await setDoc(doc(db, 'levels', levelId, 'sounds', `${levelId}-base`), {
                 id: `${levelId}-base`,
                 levelId,
                 type: 'kick',
                 patternIds: ['pattern-4onfloor'],
                 sampleUrl: ''
               }, { merge: true });
            }
          }
        }
      }

      // 6. Knowledge Base
      const articles: Partial<Article>[] = [
        { id: 'article-producing', categoryId: 'intro', title: 'Producing Basics', minRole: 'free', content: `Was ist Producing? Musikproduktion ist der kreative und technische Prozess, bei dem ein Song von der ersten Idee bis zur finalen Version gestaltet wird.\n\n# Die Phasen der Musikproduktion\n\nPHASE:COMPOSING|*Ideenfindung und Songwriting:*\nZu Beginn steht oft eine grobe Idee oder eine Melodie. Ein Producer kann diese Idee weiterentwickeln, neue Akkordfolgen hinzufügen oder einen Text schreiben.|article-composing\n\nPHASE:RECORDING|In der Aufnahmephase werden die einzelnen Spuren eines Songs aufgenommen, z. B. Gesang, Instrumente oder elektronische Elemente.|article-recording\n\nPHASE:EDITING|Nach den Aufnahmen folgt das Bearbeiten der einzelnen Spuren. Dies umfasst das Schneiden, Korrigieren und Optimieren der Aufnahmen.|article-editing\n\nPHASE:ARRANGEMENT|Der Producer fügt verschiedene Elemente zusammen und sorgt dafür, dass der Song eine ausgewogene Struktur hat.|article-arrangement\n\nPHASE:SOUNDDESIGN|In dieser Phase geht es darum, die perfekten Klänge zu kreieren oder auszuwählen, um dem Track eine einzigartige Atmosphäre zu verleihen.|article-sounddesign\n\nPHASE:MIXING / MASTERING|Im Mixing werden alle Spuren harmonisch abgestimmt. Das abschließende Mastering stellt sicher, dass der Song professionell klingt.|article-mixing-mastering` },
        { id: 'article-composing', categoryId: 'composing', title: 'Composing Deep Dive', minRole: 'admin', content: `Composing ist das Herzstück deiner musikalischen Identität.` },
        { id: 'article-recording', categoryId: 'recording', title: 'Recording Deep Dive', minRole: 'admin', content: `Die Qualität deiner Aufnahme bestimmt das Endergebnis.` },
        { id: 'article-editing', categoryId: 'recording', title: 'Editing Basics', minRole: 'admin', content: `Präzision im Detail.` },
        { id: 'article-arrangement', categoryId: 'composing', title: 'Arrangement Guide', minRole: 'admin', content: `Struktur & Flow.` },
        { id: 'article-sounddesign', categoryId: 'composing', title: 'Sound Design 101', minRole: 'admin', content: `Erschaffe neue Welten.` },
        { id: 'article-mixing-mastering', categoryId: 'recording', title: 'Mixing & Mastering', minRole: 'admin', content: `Der finale Schliff.` },
        { id: 'article-daws', categoryId: 'daws', title: 'Digital Audio Workstations', minRole: 'admin', content: `Deine DAW ist deine Schaltzentrale.` },
        { id: 'article-effects', categoryId: 'effects', title: 'Effekte & Plugins', minRole: 'admin', content: `Effekte geben deinem Sound Charakter.` },
        { id: 'article-djing', categoryId: 'djing', title: 'DJing & Performance', minRole: 'admin', content: `Bringe deine Musik auf die Bühne.` },
        { id: 'article-brand', categoryId: 'brand', title: 'Brand & Marketing', minRole: 'admin', content: `Werde zur Marke.` },
        { id: 'article-release', categoryId: 'release', title: 'Release Strategie', minRole: 'admin', content: `Der Weg zum ersten Release.` },
        { id: 'article-rights', categoryId: 'rights', title: 'Rechte & Business', minRole: 'admin', content: `Schütze deine Werke.` },
        { id: 'article-others', categoryId: 'others', title: 'Weitere Themen', minRole: 'admin', content: `Noch mehr Know-How.` }
      ];

      for (const art of articles) {
        await setDoc(doc(db, 'articles', art.id!), art, { merge: true });
      }

      toast({ title: "Rack Fully Synced!", description: "All studios restored with 3 modules and 4 levels each." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Sync Failed" });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-body flex flex-col relative select-none">
      <div className="fixed inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '60px 60px' }} />
      
      <header className="sticky top-0 p-4 md:p-8 flex flex-col items-center z-50 shrink-0 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex flex-col items-center gap-6 w-full max-w-7xl">
          <div className="flex items-center justify-center w-full">
            <h1 className="text-4xl md:text-7xl font-black tracking-[-0.05em] uppercase italic leading-none text-gradient pr-4">BeatHero</h1>
          </div>

          <div className="flex items-center justify-center w-full relative">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-auto">
              <TabsList className="bg-white/5 border border-white/5 rounded-full p-1 h-12 md:h-14">
                <TabsTrigger value="studios" className="rounded-full px-6 md:px-12 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase italic tracking-tighter transition-all">
                  <LayoutGrid className="w-4 h-4 mr-2 hidden sm:inline" /> Studios
                </TabsTrigger>
                <TabsTrigger value="learn" className="rounded-full px-6 md:px-12 data-[state=active]:bg-[#00E676] data-[state=active]:text-black font-black uppercase italic tracking-tighter transition-all">
                  <GraduationCap className="w-4 h-4 mr-2 hidden sm:inline" /> Learn
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="absolute right-0 hidden md:block">
              <div className="gemini-border gemini-glow-accent p-1.5 px-6 bg-black/80 backdrop-blur-3xl border border-white/5 shrink-0">
                <div className="text-white font-black text-xl md:text-3xl leading-none tracking-tighter flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FFEA00]" fill="currentColor" />
                  {streetCred.toLocaleString()} <span className="text-primary italic font-black">SC</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'studios' && (
          <div className="flex flex-col md:flex-row items-center gap-4 w-full max-w-7xl mt-8">
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search Studios..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 md:h-12 bg-white/5 border-white/10 rounded-full focus:ring-primary focus:border-primary placeholder:text-white/10 text-xs md:text-sm font-bold uppercase tracking-widest"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto w-full pb-1 scrollbar-hide no-scrollbar">
              {dynamicTags.map(tag => (
                <Button
                  key={tag}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTag(tag)}
                  className={cn(
                    "rounded-full text-[10px] md:text-xs font-black uppercase tracking-[0.15em] px-5 h-9 md:h-10 border transition-all shrink-0",
                    selectedTag === tag ? "bg-primary border-primary text-white" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                  )}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="relative flex-1 w-full max-w-7xl mx-auto py-6 md:py-10 px-4 md:px-6">
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="studios" className="m-0 focus-visible:ring-0 outline-none">
            {isLoadingStudios ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-xs md:text-sm font-black uppercase tracking-[0.4em] opacity-30">Connecting to Rack...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                {filteredStudios.map((studio) => {
                  const isLocked = !hasAccess(profile?.role, studio.minRole || 'free');
                  return (
                    <Link 
                      key={studio.id} 
                      href={isLocked ? '#' : `/studio/${studio.id}`} 
                      className={cn(
                        "block transform transition-transform hover:scale-[1.03] active:scale-95",
                        isLocked && "cursor-not-allowed"
                      )}
                    >
                      <StudioCard studio={studio} isLocked={isLocked} />
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="learn" className="m-0 focus-visible:ring-0 outline-none">
            <LearnView />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="sticky bottom-0 p-3 md:p-4 border-t border-white/5 bg-black/95 backdrop-blur-2xl flex justify-between items-center z-50 shrink-0">
        <div className="flex items-center gap-3 opacity-30">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-[10px] md:text-xs uppercase font-black tracking-[0.2em] hidden sm:inline">Modular Rack System Online</span>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={setupStudios} 
            className="bg-[#FFEA00] text-black hover:bg-[#FFEA00]/90 font-black uppercase italic tracking-tighter border-none shadow-[0_0_15px_rgba(255,234,0,0.2)] h-10 md:h-12 px-8 md:px-12 text-sm md:text-base transition-transform active:scale-95"
          >
            <RefreshCw className="w-4 h-4 md:w-5 md:h-5 mr-3" /> Rack Sync
          </Button>
        </div>
      </footer>
    </div>
  );
}
