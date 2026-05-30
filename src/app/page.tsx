
"use client";

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, setDoc, getDocs } from 'firebase/firestore';
import { Studio, hasAccess, Article } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initiateGoogleSignIn, initiateSignOut } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import { cn } from '@/lib/utils';
import { RefreshCw, Loader2, Zap, LayoutGrid, GraduationCap, Lock, LogOut, LogIn, Download, Upload, Sparkles, ArrowRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LearnView } from '@/components/learn/LearnView';
import { ProfileView } from '@/components/profile/ProfileView';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const StudioCard = ({ studio, isLocked }: { studio: Studio; isLocked: boolean }) => (
  <div className={cn(
    "relative group cursor-pointer transition-all duration-500 overflow-hidden rounded-lg border border-white/5 bg-black/40 hover:border-primary/50 shadow-2xl aspect-square w-full",
    isLocked && "opacity-60 grayscale-[0.5]"
  )}>
    <div className="absolute inset-0 overflow-hidden">
      {studio.imageUrl ? (
        <Image src={studio.imageUrl} alt={studio.name} fill className="object-cover opacity-100 group-hover:scale-110 transition-all duration-1000" sizes="(max-width: 640px) 50vw, 25vw" />
      ) : (
        <div className="absolute inset-0 opacity-100" style={{ backgroundColor: studio.coverColor }} />
      )}
    </div>
    {isLocked && <div className="absolute top-4 right-4 z-30 bg-black/60 backdrop-blur-md p-1.5 rounded-full border border-white/10"><Lock className="w-4 h-4 text-white/40" /></div>}
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
    <div className="absolute inset-0 p-4 flex flex-col justify-end items-center text-center z-20 pb-6">
      <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white group-hover:text-primary transition-colors leading-[0.85] drop-shadow-lg">{studio.name}</h3>
    </div>
  </div>
);

function HomeContent() {
  const db = useFirestore();
  const auth = useAuth();
  const searchParams = useSearchParams();
  const { user, profile, isUserLoading } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('studios');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const inviteId = searchParams.get('invite');
  const invitedArticleRef = useMemoFirebase(() => inviteId && db ? doc(db, 'articles', inviteId) : null, [db, inviteId]);
  const { data: invitedArticle } = useDoc<Article>(invitedArticleRef);

  useEffect(() => {
    const savedTab = localStorage.getItem('beathero_active_tab');
    if (savedTab) setActiveTab(savedTab);
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem('beathero_active_tab', value);
  };

  useEffect(() => {
    if (user && db && !isUserLoading) {
      const needsSync = !profile || profile.email !== (user.email ?? '');

      if (needsSync) {
        const userRef = doc(db, 'users', user.uid);
        const data = { 
          uid: user.uid, 
          email: user.email ?? '', 
          streetCred: profile?.streetCred ?? 0, 
          role: profile?.role ?? 'free',
          displayName: profile?.displayName || user.displayName || 'Producer'
        };
        setDoc(userRef, data, { merge: true }).catch(err => {
          console.warn("Profile auto-sync failed", err);
        });
      }
    }
  }, [user, profile, isUserLoading, db]);

  const studiosQuery = useMemoFirebase(() => db ? query(collection(db, 'studios')) : null, [db]);
  const { data: studios, isLoading: isLoadingStudios } = useCollection<Studio>(studiosQuery);

  const handleSCButtonClick = () => {
    handleTabChange('progress');
  };

  const handleBackup = async () => {
    if (!db || profile?.role !== 'admin') return;
    setIsBackingUp(true);
    try {
      const data: any = {};
      const rootCols = ['studios', 'tracks', 'games', 'learnApps', 'levels', 'patterns', 'learnCategories', 'learnSubCats', 'articles', 'learnQuizzes', 'users'];
      
      for (const col of rootCols) {
        const snap = await getDocs(collection(db, col));
        data[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = `beathero_backup_${new Date().toISOString()}.json`; 
      a.click();
      toast({ title: "Backup Complete" });
    } catch (e) { toast({ variant: "destructive", title: "Backup Failed" }); } finally { setIsBackingUp(false); }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || profile?.role !== 'admin') return;
    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        for (const [col, items] of Object.entries(data)) {
          if (Array.isArray(items)) {
            for (const item of items) {
              const { id, ...rest } = item as any;
              if (!id) continue;
              await setDoc(doc(db, col, id), rest, { merge: true });
            }
          }
        }
        toast({ title: "Restore Successful" });
      } catch (err) { toast({ variant: "destructive", title: "Restore Failed" }); } finally { setIsRestoring(false); }
    };
    reader.readAsText(file);
  };

  const setupStudios = async () => {
    if (!db || profile?.role !== 'admin') return;
    setIsSyncing(true);
    let fixed = 0;

    try {
      const cats = [
        { id: 'intro', title: 'Einführung', iconName: 'BookOpen', colorClass: 'text-primary', order: 10, minRole: 'free' },
        { id: 'daws', title: 'DAWs', iconName: 'Cpu', colorClass: 'text-[#00E676]', order: 20, minRole: 'free' },
        { id: 'composing', title: 'Composing', iconName: 'Music', colorClass: 'text-[#FFEA00]', order: 30, minRole: 'free' },
        { id: 'recording', title: 'Recording', iconName: 'Mic2', colorClass: 'text-[#FF3D00]', order: 40, minRole: 'free' },
        { id: 'effects', title: 'Effekte', iconName: 'Wand2', colorClass: 'text-[#3838FA]', order: 50, minRole: 'free' },
        { id: 'djing', title: 'DJing', iconName: 'Disc', colorClass: 'text-primary', order: 60, minRole: 'free' },
        { id: 'social', title: 'Media & Release', iconName: 'Share2', colorClass: 'text-[#00FFFF]', order: 70, minRole: 'free' },
        { id: 'rights', title: 'Rechte', iconName: 'Scale', colorClass: 'text-[#EB3D99]', order: 80, minRole: 'free' }
      ];
      for (const c of cats) {
        await setDoc(doc(db, 'learnCategories', c.id), c, { merge: true });
        fixed++;
      }
      toast({ title: "Rack Synced", description: `${fixed} entries updated.` });
    } catch (e) { toast({ variant: "destructive", title: "Sync Failed" }); } finally { setIsSyncing(false); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative">
      <header className="sticky top-0 p-4 md:p-8 flex flex-col items-center z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex justify-between w-full max-w-7xl items-center mb-6">
          <h1 className="text-4xl md:text-7xl font-black uppercase italic text-gradient">BeatHero</h1>
          <div className="flex items-center gap-4">
            <div 
              onClick={handleSCButtonClick} 
              className="gemini-border p-2 px-4 bg-black/80 cursor-pointer flex items-center gap-2 hover:bg-black transition-colors"
            >
              <Zap className="w-4 h-4 text-[#FFEA00]" fill="currentColor" />
              <span className="font-black italic">{(profile?.streetCred || 0).toLocaleString()} SC</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 w-10 md:h-12 md:w-12 rounded-full p-0 border border-white/10">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={user?.photoURL || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary font-black uppercase italic">{user?.displayName?.charAt(0) || '?'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-black/90 border-white/10 text-white backdrop-blur-xl">
                <DropdownMenuItem onClick={() => auth && initiateGoogleSignIn(auth)} className="cursor-pointer font-bold"><LogIn className="mr-2 h-4 w-4" /> Login with Google</DropdownMenuItem>
                <DropdownMenuItem onClick={() => auth && initiateSignOut(auth)} className="cursor-pointer text-destructive font-bold"><LogOut className="mr-2 h-4 w-4" /> Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-white/5 rounded-full p-1 h-12 md:h-14">
            <TabsTrigger value="studios" className="rounded-full px-6 md:px-12 data-[state=active]:bg-primary font-black uppercase italic tracking-tighter"><LayoutGrid className="w-4 h-4 mr-2" /> Studios</TabsTrigger>
            <TabsTrigger value="learn" className="rounded-full px-6 md:px-12 data-[state=active]:bg-[#00E676] data-[state=active]:text-black font-black uppercase italic tracking-tighter"><GraduationCap className="w-4 h-4 mr-2" /> Learn</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>
      
      <main className="flex-1 w-full max-w-7xl mx-auto py-6 md:py-10 px-4 md:px-6">
        {invitedArticle && (
          <div className="mb-10 animate-in zoom-in-95 duration-700">
            <div className="gemini-border-primary overflow-hidden">
              <div className="p-6 bg-black/60 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20"><Sparkles className="w-8 h-8 text-primary" /></div>
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary italic mb-1">Direct Assignment</h3>
                    <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white">{invitedArticle.title}</h2>
                  </div>
                </div>
                <Link href={`/learn/article/${invitedArticle.id}`}>
                  <Button className="bg-white text-black font-black uppercase italic rounded-full h-14 px-10 flex items-center gap-2 group shadow-2xl">
                    Launch Mission <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} className="w-full">
          <TabsContent value="studios" className="m-0">
            {isLoadingStudios ? <div className="h-64 flex flex-col items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div> : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                {studios?.map(s => {
                  const locked = !hasAccess(profile?.role, s.minRole || 'free');
                  return (
                    <Link key={s.id} href={locked ? '#' : `/studio/${s.id}`} className={cn("block transform transition-transform hover:scale-105", locked && "cursor-not-allowed")}><StudioCard studio={s} isLocked={locked} /></Link>
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="learn" className="m-0"><LearnView /></TabsContent>
          <TabsContent value="progress" className="m-0"><ProfileView /></TabsContent>
        </Tabs>
      </main>

      {profile?.role === 'admin' && (
        <footer className="sticky bottom-0 p-4 border-t border-white/5 bg-black/95 backdrop-blur-2xl flex justify-center gap-4 z-50">
          <input type="file" ref={fileInputRef} onChange={handleRestore} className="hidden" accept=".json" />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isRestoring} className="font-black uppercase italic tracking-tighter bg-white/5"><Upload className="w-4 h-4 mr-2" /> Restore</Button>
          <Button variant="outline" onClick={handleBackup} disabled={isBackingUp} className="font-black uppercase italic tracking-tighter bg-white/5"><Download className="w-4 h-4 mr-2" /> Backup</Button>
          <Button variant="outline" onClick={setupStudios} disabled={isSyncing} className="bg-[#FFEA00] text-black hover:bg-[#FFEA00]/90 font-black uppercase italic tracking-tighter border-none"><RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} /> Rack Sync</Button>
        </footer>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <HomeContent />
    </Suspense>
  );
}
