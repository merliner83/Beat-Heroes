
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { Studio, Game, Article, Track, hasAccess } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { initiateAnonymousSignIn, initiateGoogleSignIn, initiateSignOut } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import { cn } from '@/lib/utils';
import { RefreshCw, Loader2, Zap, Search, LayoutGrid, GraduationCap, Lock, User as UserIcon, LogOut, LogIn } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LearnView } from '@/components/learn/LearnView';
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
  const { user, profile, isUserLoading } = useUser();
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
    if (user && db && !isUserLoading) {
      const needsSync = !profile || (profile.email !== (user.email ?? ''));

      if (needsSync) {
        const userRef = doc(db, 'users', user.uid);
        const data: any = { 
          uid: user.uid, 
          email: user.email ?? '', 
        };

        if (!profile) {
          data.streetCred = 0;
          data.role = 'free';
        }

        setDoc(userRef, data, { merge: true })
          .catch(async (error) => {
            const permissionError = new FirestorePermissionError({
              path: userRef.path,
              operation: 'write',
              requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
          });
      }
    }
  }, [user, profile, isUserLoading, db]);

  const isAdmin = profile?.role === 'admin';
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
      // Instrument Sample URLs
      const kickUrl = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FKICK1.mp3?alt=media&token=23415b38-2c12-4462-bb74-385533ad1c57';
      const clapUrl = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FClap%201.mp3?alt=media&token=59073468-4861-40f3-9df2-f8c5f59d79df';
      
      // Lazer Sounds for Vinyl Hunter
      const lazer1 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FLazer%2FLazer%20001.mp3?alt=media&token=b73ec61d-740b-42f3-b5a3-41a44e2f4fee';
      const lazer2 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FLazer%2FLazer%200010.mp3?alt=media&token=48271588-84b9-43be-acad-d9f6d8e38faf';
      const lazer3 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FLazer%2FLazer%20006.mp3?alt=media&token=848197cf-a315-4aca-82ad-ec10828a1872';
      const lazer4 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FLazer%2FLazer%20Digitalo.mp3?alt=media&token=60e9536d-00e4-4fdd-805b-9268d9a7b339';

      const vinylHunterBg = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/games%2Fstrassen%20ecke%20im%20hiphop%20style%20mit%20einem%20ghettoblaster%20unten%20aber%20ohne%20leute.jpg?alt=media&token=07390b34-9c29-4334-b810-a0a1ae10c596';

      // Patterns (8 bars / 128 steps)
      const patterns = [
        { id: 'kick-intro-1', data: { id: 'kick-intro-1', name: 'Intro 1-Shot', steps: [0, 16, 32, 48, 64, 80, 96, 112] } },
        { id: 'kick-verse-2', data: { id: 'kick-verse-2', name: 'Verse 2-Shot', steps: Array.from({length: 128}, (_, i) => i % 8 === 0 ? i : -1).filter(v => v !== -1) } }, 
        { id: 'kick-refrain-4', data: { id: 'kick-refrain-4', name: 'Refrain 4-Shot', steps: Array.from({length: 128}, (_, i) => i % 4 === 0 ? i : -1).filter(v => v !== -1) } }, 
        { id: 'kick-hiphop-sync', data: { id: 'kick-hiphop-sync', name: 'HipHop Sync', steps: Array.from({length: 8}, (_, bar) => [0, 6, 10, 14].map(s => s + bar * 16)).flat() } },
        { id: 'kick-buildup-fast', data: { id: 'kick-buildup-fast', name: 'Buildup Fast', steps: [0, 4, 8, 12, 16, 18, 20, 22, 24, 26, 28, 30, ...Array.from({length: 32}, (_, i) => i + 32)] } },
        { id: 'kick-techno-4-4', data: { id: 'kick-techno-4-4', name: 'Techno 4-on-Floor', steps: Array.from({length: 8}, (_, bar) => [0, 4, 8, 12].map(s => s + bar * 16)).flat() } },
      ];

      for (const p of patterns) {
        const pRef = doc(db, 'patterns', p.id);
        setDoc(pRef, p.data, { merge: true });
      }

      const commonTags = ['Hip-Hop', 'Electro'];

      // Studios
      const studios: Studio[] = [
        { id: 'std-gabriel', name: 'Gabriel Beats', description: 'Handcrafted signature sounds.', coverColor: '#FF9100', district: 'Creative Hub', tags: commonTags, minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FGabriel%20Studio.png?alt=media&token=2f1e1b66-7f23-461b-9377-f738ea0ce79f' },
        { id: 'std-nintu', name: 'Nintu Music', description: 'Deep melodic explorations.', coverColor: '#993DEB', district: 'Melody District', tags: commonTags, minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2Fstudioo.png?alt=media&token=9a547bdf-a3bf-4a9a-a132-222383e88b1f' },
        { id: 'std-yoan', name: 'Yoan Beats', description: 'Raw urban textures.', coverColor: '#3838FA', district: 'Underground', tags: commonTags, minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FYoan%20Beats.png?alt=media&token=984099f0-f45b-4836-81d0-35241d774d83' },
        { id: 'std-dave', name: 'Dave Beats', description: 'Dave Beats is smarter than you think.', coverColor: '#EB3D99', district: 'The Lab', tags: commonTags, minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2Fstudio%202.png?alt=media&token=96cb0afc-36e3-4c58-8e5d-45a68cd4673a' },
        { id: 'std-noxxos', name: 'Noxxos', description: 'Futuristic club anthems.', coverColor: '#FF3D00', district: 'Skyline', tags: commonTags, minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FNoxxos%20Studio.png?alt=media&token=fa9f78bc-965b-4af2-bfde-4f0383a87d98' }
      ];
      for (const s of studios) {
        const sRef = doc(db, 'studios', s.id);
        setDoc(sRef, s, { merge: true });
      }

      // Track URLs
      const gTr1 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FGabriel%20Beats%2FGabriel%201_140bpm.mp3?alt=media&token=0d094a95-7a8c-40a4-8e17-c1eebf721540';
      const gTr2 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FGabriel%20Beats%2FGabriel%202_148bpm.mp3?alt=media&token=1f877a36-c331-4286-97ce-aad7f1edf807';
      const gTr3 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FGabriel%20Beats%2Fgabriel%204%20150bpm%20scratch.mp3?alt=media&token=d4a447a1-5c31-4aeb-acab-146fccc039b8';
      const gTr4 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FGabriel%20Beats%2Fgabriel%205%20162bpm.mp3?alt=media&token=deefca2b-1ace-4e53-948f-8ce581aca7f6';
      const gTr5 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FGabriel%20Beats%2FGabriel%208%20160bpm.mp3?alt=media&token=385d3a0c-c51c-4801-8ec4-18b0f9eedf2f';

      const freestyleUrl = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FDave%20Beats%2FDavid%20ist%20Schlau%20aber%20Merlin%20ist%20Ganz%20Ganz%20Ganz%20Dummmmmmm%20120%20bpm.mp3?alt=media&token=fd38176e-faaf-4465-872a-1847f5b37960';

      const tracks: Track[] = [
        { id: 'tr-d1', studioId: 'std-dave', name: 'Freestyle', author: 'Dave', url: freestyleUrl },
        { id: 'tr-g1', studioId: 'std-gabriel', name: 'Track 1', author: 'Gabriel', url: gTr1 },
        { id: 'tr-g2', studioId: 'std-gabriel', name: 'Track 2', author: 'Gabriel', url: gTr2 },
        { id: 'tr-g3', studioId: 'std-gabriel', name: 'Track 3', author: 'Gabriel', url: gTr3 },
        { id: 'tr-g4', studioId: 'std-gabriel', name: 'Track 4', author: 'Gabriel', url: gTr4 },
        { id: 'tr-g5', studioId: 'std-gabriel', name: 'Track 5', author: 'Gabriel', url: gTr5 },
        { id: 'tr-n1', studioId: 'std-nintu', name: 'Deep Echoes', author: 'Nintu', url: 'https://actions.google.com/sounds/v1/science_fiction/glitch_low_power.ogg' },
        { id: 'tr-y1', studioId: 'std-yoan', name: 'Street Vibes', author: 'Yoan', url: 'https://actions.google.com/sounds/v1/science_fiction/glitch_low_power.ogg' },
        { id: 'tr-nx1', studioId: 'std-noxxos', name: 'Neon Night', author: 'Noxxos', url: 'https://actions.google.com/sounds/v1/science_fiction/glitch_low_power.ogg' }
      ];
      for (const t of tracks) {
        const tRef = doc(db, 'tracks', t.id);
        setDoc(tRef, t, { merge: true });
      }

      // Games
      const gameConfigs = [
        { type: 'rhythm-producer' as const, name: 'Beat Hero' },
        { type: 'sample-hunter' as const, name: 'Vinyl Hunter' },
        { type: 'disk-dash' as const, name: 'Sonic Dash' }
      ];

      for (const s of studios) {
        for (const config of gameConfigs) {
          const gameId = `${s.id}-${config.type}`;
          const isBeatHero = config.type === 'rhythm-producer';
          const isVinylHunter = config.type === 'sample-hunter';
          
          let gameBpm = 128;
          let gameBackingUrl = '';
          
          if (s.id === 'std-dave') {
            gameBpm = 120;
            gameBackingUrl = freestyleUrl;
          } else if (s.id === 'std-gabriel') {
            if (isBeatHero) {
              gameBpm = 148;
              gameBackingUrl = gTr2;
            } else if (isVinylHunter) {
              gameBpm = 150;
              gameBackingUrl = gTr3;
            } else {
              gameBpm = 140;
              gameBackingUrl = gTr1;
            }
          }

          const gData = {
            id: gameId, studioId: s.id, name: config.name, type: config.type,
            difficulty: 1, minRole: 'free', bpm: gameBpm,
            backingTrackUrl: gameBackingUrl, backgroundImageUrl: isVinylHunter ? vinylHunterBg : ''
          };
          const gRef = doc(db, 'games', gameId);
          setDoc(gRef, gData, { merge: true });

          for (let i = 1; i <= 4; i++) {
            const levelId = `${gameId}-lvl${i}`;
            const lRef = doc(db, 'levels', levelId);
            setDoc(lRef, { id: levelId, gameId, difficulty: i, name: `Level ${i}` }, { merge: true });

            if (isBeatHero) {
              const isDave = s.id === 'std-dave';
              const kickData = {
                id: `${levelId}-kick`, levelId, type: 'kick', sampleUrl: kickUrl,
                patternIds: isDave ? ['kick-hiphop-sync', 'kick-buildup-fast', 'kick-techno-4-4'] : ['kick-intro-1', 'kick-verse-2', 'kick-refrain-4']
              };
              setDoc(doc(db, 'levels', levelId, 'sounds', `${levelId}-kick`), kickData, { merge: true });
            }
            if (isVinylHunter) {
              const kickData = {
                id: `${levelId}-kick`, levelId, type: 'kick', sampleUrl: lazer1,
                patternIds: ['kick-intro-1', 'kick-verse-2', 'kick-refrain-4']
              };
              setDoc(doc(db, 'levels', levelId, 'sounds', `${levelId}-kick`), kickData, { merge: true });
            }
          }
        }
      }

      // Sync Learn In-Apps
      const learnInApps = [
        { id: 'learn-ear-training', name: 'Ear Training', type: 'ear-training' as const },
        { id: 'learn-rhythm-trainer', name: 'Rhythm Trainer', type: 'rhythm-trainer' as const }
      ];

      for (const app of learnInApps) {
        const appRef = doc(db, 'games', app.id);
        setDoc(appRef, {
          id: app.id,
          studioId: 'learn-center',
          name: app.name,
          type: app.type,
          difficulty: 1,
          minRole: 'free',
          bpm: 128
        }, { merge: true });

        // Add levels for learn apps
        for (let i = 1; i <= 1; i++) {
          const levelId = `${app.id}-lvl${i}`;
          setDoc(doc(db, 'levels', levelId), { id: levelId, gameId: app.id, difficulty: i, name: 'Basic' }, { merge: true });
        }
      }

      toast({ title: "Rack Fully Synced!", description: "All modules including Learn-InApps online." });
    } catch (e) {
      toast({ variant: "destructive", title: "Sync Failed" });
    }
  };

  const isAnonymous = user?.isAnonymous;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-body font-normal flex flex-col relative select-none">
      <div className="fixed inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#FF3399 1.5px, transparent 1.5px)', backgroundSize: '60px 60px' }} />
      
      <header className="sticky top-0 p-4 md:p-8 flex flex-col items-center z-50 shrink-0 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex flex-col items-center gap-6 w-full max-w-7xl relative">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-4xl md:text-7xl font-black tracking-[-0.05em] uppercase italic leading-none text-gradient pr-4">BeatHero</h1>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex gemini-border gemini-glow-accent p-1.5 px-6 bg-black/80 backdrop-blur-3xl border border-white/5 shrink-0">
                <div className="text-white font-black text-xl md:text-3xl leading-none tracking-tighter flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FFEA00]" fill="currentColor" />
                  {streetCred.toLocaleString()} <span className="text-primary italic font-black">SC</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-12 w-12 rounded-full p-0 border border-white/10 hover:bg-white/5">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "User"} />
                      <AvatarFallback className="bg-primary/20 text-primary font-black">
                        {user?.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="w-6 h-6" />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-black/90 border-white/10 text-white backdrop-blur-xl rounded-xl" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-black uppercase italic tracking-tighter leading-none">
                        {user?.displayName || (isAnonymous ? "Guest Mode" : "Music Producer")}
                      </p>
                      <p className="text-[10px] leading-none opacity-40 font-bold uppercase tracking-widest">
                        {user?.email || `ID: ${user?.uid.substring(0, 8)}...`}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem className="focus:bg-primary/20 focus:text-white cursor-pointer py-3">
                    <Zap className="mr-2 h-4 w-4 text-[#FFEA00]" />
                    <span className="font-black uppercase italic tracking-tighter text-xs">{streetCred} Street Cred</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-primary/20 focus:text-white cursor-pointer py-3">
                    <GraduationCap className="mr-2 h-4 w-4" />
                    <span className="font-black uppercase italic tracking-tighter text-xs">Role: {profile?.role?.toUpperCase() || "FREE"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {isAnonymous ? (
                    <DropdownMenuItem 
                      className="focus:bg-[#00E676]/20 focus:text-[#00E676] cursor-pointer py-3"
                      onClick={() => auth && initiateGoogleSignIn(auth)}
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      <span className="font-black uppercase italic tracking-tighter text-xs">Login with Google</span>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem 
                      className="focus:bg-destructive/20 focus:text-destructive cursor-pointer py-3"
                      onClick={() => auth && initiateSignOut(auth)}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span className="font-black uppercase italic tracking-tighter text-xs">Sign Out</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 w-full overflow-hidden">
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
          {isAdmin && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={setupStudios} 
              className="bg-[#FFEA00] text-black hover:bg-[#FFEA00]/90 font-black uppercase italic tracking-tighter border-none shadow-[0_0_15px_rgba(255,234,0,0.2)] h-10 md:h-12 px-8 md:px-12 text-sm md:text-base transition-transform active:scale-95"
            >
              <RefreshCw className="w-4 h-4 md:w-5 md:h-5 mr-3" /> Rack Sync
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
