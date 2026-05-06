
"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { Studio, Game, Article, Track, hasAccess, LearnApp, TriggerPattern, LearnSubCat } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initiateAnonymousSignIn, initiateGoogleSignIn, initiateSignOut } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import { cn } from '@/lib/utils';
import { RefreshCw, Loader2, Zap, LayoutGrid, GraduationCap, Lock, User as UserIcon, LogOut, LogIn, Download, Upload } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LearnView } from '@/components/learn/LearnView';
import { ProfileView } from '@/components/profile/ProfileView';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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

export default function HomePage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user, profile, isUserLoading } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('studios');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const savedTab = localStorage.getItem('beathero_active_tab');
    if (savedTab) setActiveTab(savedTab);
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem('beathero_active_tab', value);
  };

  useEffect(() => {
    if (!user && auth) initiateAnonymousSignIn(auth);
  }, [user, auth]);

  useEffect(() => {
    if (user && db && !isUserLoading) {
      if (!profile || profile.email !== (user.email ?? '')) {
        const userRef = doc(db, 'users', user.uid);
        const data = { uid: user.uid, email: user.email ?? '', streetCred: profile?.streetCred ?? 0, role: profile?.role ?? 'free' };
        setDoc(userRef, data, { merge: true }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: 'write', requestResourceData: data })));
      }
    }
  }, [user, profile, isUserLoading, db]);

  const studiosQuery = useMemoFirebase(() => db ? query(collection(db, 'studios')) : null, [db]);
  const { data: studios, isLoading: isLoadingStudios } = useCollection<Studio>(studiosQuery);

  const handleBackup = async () => {
    if (!db || profile?.role !== 'admin') return;
    setIsBackingUp(true);
    try {
      const data: any = {};
      const rootCols = ['studios', 'tracks', 'games', 'learnApps', 'levels', 'patterns', 'learnSubCats', 'articles', 'users'];
      
      for (const col of rootCols) {
        const snap = await getDocs(collection(db, col));
        data[col] = await Promise.all(snap.docs.map(async (d) => {
          const docData = { id: d.id, ...d.data() };
          
          // Check for subcollections
          if (col === 'levels') {
            const soundsSnap = await getDocs(collection(db, col, d.id, 'sounds'));
            (docData as any).sounds = soundsSnap.docs.map(sd => ({ id: sd.id, ...sd.data() }));
          }
          if (col === 'users') {
            const progSnap = await getDocs(collection(db, col, d.id, 'progress'));
            (docData as any).progress = progSnap.docs.map(pd => ({ id: pd.id, ...pd.data() }));
            
            const pattProgSnap = await getDocs(collection(db, col, d.id, 'patternProgress'));
            (docData as any).patternProgress = pattProgSnap.docs.map(ppd => ({ id: ppd.id, ...ppd.data() }));

            const artProgSnap = await getDocs(collection(db, col, d.id, 'articleProgress'));
            (docData as any).articleProgress = artProgSnap.docs.map(apd => ({ id: apd.id, ...apd.data() }));
          }
          
          return docData;
        }));
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = `beathero_full_backup_${new Date().toISOString()}.json`; 
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
              const { id, sounds, progress, patternProgress, articleProgress, ...rest } = item as any;
              if (!id) continue;
              
              const rootRef = doc(db, col, id);
              await setDoc(rootRef, rest, { merge: true });

              // Restore subcollections
              if (sounds && Array.isArray(sounds)) {
                for (const s of sounds) {
                  const { id: sid, ...sData } = s;
                  await setDoc(doc(db, col, id, 'sounds', sid), sData, { merge: true });
                }
              }
              if (progress && Array.isArray(progress)) {
                for (const p of progress) {
                  const { id: pid, ...pData } = p;
                  await setDoc(doc(db, col, id, 'progress', pid), pData, { merge: true });
                }
              }
              if (patternProgress && Array.isArray(patternProgress)) {
                for (const pp of patternProgress) {
                  const { id: ppid, ...ppData } = pp;
                  await setDoc(doc(db, col, id, 'patternProgress', ppid), ppData, { merge: true });
                }
              }
              if (articleProgress && Array.isArray(articleProgress)) {
                for (const ap of articleProgress) {
                  const { id: apid, ...apData } = ap;
                  await setDoc(doc(db, col, id, 'articleProgress', apid), apData, { merge: true });
                }
              }
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
    let created = 0, fixed = 0;

    const sync = async (col: string, id: string, data: any) => {
      const ref = doc(db, col, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) { 
        await setDoc(ref, data); 
        created++; 
      }
      else {
        const fData = snap.data();
        const payload: any = {};
        let needs = false;
        Object.keys(data).forEach(k => { 
          if (!fData[k] || (Array.isArray(data[k]) && (!fData[k] || fData[k].length === 0))) { 
            payload[k] = data[k]; 
            needs = true; 
          } 
        });
        if (needs) { 
          await setDoc(ref, payload, { merge: true }); 
          fixed++; 
        }
      }
    };

    try {
      // --- SUB-CATEGORIES ---
      const subs = [
        { id: 'sc-gb', categoryId: 'daws', title: 'GarageBand', iconUrl: 'https://picsum.photos/seed/gb/100/100' },
        { id: 'sc-cb', categoryId: 'daws', title: 'Cubase', iconUrl: 'https://picsum.photos/seed/cb/100/100' },
        { id: 'sc-lp', categoryId: 'daws', title: 'Logic Pro', iconUrl: 'https://picsum.photos/seed/lp/100/100' },
        { id: 'sc-ab', categoryId: 'daws', title: 'Ableton Live', iconUrl: 'https://picsum.photos/seed/ab/100/100' },
        { id: 'sc-ins', categoryId: 'effects', title: 'Insert-Effekte', iconUrl: 'https://picsum.photos/seed/ins/100/100' },
        { id: 'sc-snd', categoryId: 'effects', title: 'Send-Effekte', iconUrl: 'https://picsum.photos/seed/snd/100/100' },
        { id: 'sc-crt', categoryId: 'effects', title: 'Kreative Effekte', iconUrl: 'https://picsum.photos/seed/crt/100/100' },
        { id: 'sc-instr', categoryId: 'recording', title: 'Instrumente', iconUrl: 'https://picsum.photos/seed/instr/100/100' }
      ];
      for (const s of subs) await sync('learnSubCats', s.id, s);

      // --- ARTICLES ---
      const arts = [
        // EINFÜHRUNG
        { id: 'art-welcome', categoryId: 'intro', title: 'Willkommen im Hub', content: 'Dein zentraler Knotenpunkt für Musikproduktion.', minRole: 'free' },
        { id: 'art-producing-basics', categoryId: 'intro', title: 'Producing', content: 'Hier lernst du die Grundlagen der Musikproduktion.', minRole: 'free', quiz: [{ question: 'Was ist eine DAW?', options: ['Digital Audio Workstation', 'Dark Audio Wave', 'Dynamic Audio Web'], correctOption: 0 }] },
        { id: 'art-sampling-basics', categoryId: 'intro', title: 'Sampling', content: 'Die Kunst, vorhandene Klänge neu zu kontextualisieren.', minRole: 'free' },
        { id: 'art-djing-basics', categoryId: 'intro', title: 'DJing', content: 'Grundlagen des Auflegens und Mixens.', minRole: 'free' },
        { id: 'art-equipment-intro', categoryId: 'intro', title: 'Equipment', content: 'Was du wirklich brauchst, um zu starten.', minRole: 'free' },
        
        // DAWS - GarageBand
        { id: 'art-gb-basics', categoryId: 'daws', subCategoryId: 'sc-gb', title: 'GarageBand: Basics', content: 'Erste Schritte in GarageBand.', minRole: 'free' },
        { id: 'art-gb-shortcuts', categoryId: 'daws', subCategoryId: 'sc-gb', title: 'GarageBand: Shortcuts', content: 'Die wichtigsten Tastenkombinationen.', minRole: 'free' },
        { id: 'art-gb-vocal', categoryId: 'daws', subCategoryId: 'sc-gb', title: 'GarageBand: Vocal Chain', content: 'Dein Setup für perfekte Vocals.', minRole: 'free' },
        { id: 'art-gb-master', categoryId: 'daws', subCategoryId: 'sc-gb', title: 'GarageBand: Mastering Chain', content: 'Der finale Schliff für deinen Track.', minRole: 'free' },
        
        // DAWS - Logic
        { id: 'art-lp-basics', categoryId: 'daws', subCategoryId: 'sc-lp', title: 'Logic Pro: Basics', content: 'Profi-Produktion leicht gemacht.', minRole: 'free' },
        
        // EFFEKTE
        { id: 'art-eq', categoryId: 'effects', subCategoryId: 'sc-ins', title: 'Equalizer', content: 'Forme deinen Sound mit dem EQ.', minRole: 'free' },
        { id: 'art-reverb', categoryId: 'effects', subCategoryId: 'sc-snd', title: 'Reverb', content: 'Erzeuge Raumtiefe mit Hall.', minRole: 'free' },
        
        // RECORDING - Instrumente
        { id: 'art-drums', categoryId: 'recording', subCategoryId: 'sc-instr', title: 'Drums', content: 'Wie man ein Schlagzeug mikrofoniert.', minRole: 'free' },
        { id: 'art-git-ac', categoryId: 'recording', subCategoryId: 'sc-instr', title: 'Gitarre (Akustisch)', content: 'Der natürliche Sound der Akustikgitarre.', minRole: 'free' }
      ];
      for (const a of arts) await sync('articles', a.id, a);

      toast({ title: "Rack Synced", description: `${created} created, ${fixed} repaired.` });
    } catch (e) { toast({ variant: "destructive", title: "Sync Failed" }); } finally { setIsSyncing(false); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative">
      <header className="sticky top-0 p-4 md:p-8 flex flex-col items-center z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex justify-between w-full max-w-7xl items-center mb-6">
          <h1 className="text-4xl md:text-7xl font-black uppercase italic text-gradient">BeatHero</h1>
          <div className="flex items-center gap-4">
            <div onClick={() => setActiveTab('progress')} className="gemini-border p-2 px-4 bg-black/80 cursor-pointer flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FFEA00]" fill="currentColor" />
              <span className="font-black italic">{profile?.streetCred?.toLocaleString() || 0} SC</span>
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
                <DropdownMenuItem onClick={() => auth && initiateGoogleSignIn(auth)} className="cursor-pointer"><LogIn className="mr-2 h-4 w-4" /> Login with Google</DropdownMenuItem>
                <DropdownMenuItem onClick={() => auth && initiateSignOut(auth)} className="cursor-pointer text-destructive"><LogOut className="mr-2 h-4 w-4" /> Sign Out</DropdownMenuItem>
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
