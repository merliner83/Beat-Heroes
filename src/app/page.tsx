
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, setDoc } from 'firebase/firestore';
import { Studio, Game, Article, Track, hasAccess, LearnApp } from '@/lib/game/types';
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
          data-ai-hint="studio image"
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
      // DEFINITIVE SOUND URLS
      const S_KICK = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FKICK1.mp3?alt=media&token=23415b38-2c12-4462-bb74-385533ad1c57';
      const S_CLAP = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FClap%201.mp3?alt=media&token=59073468-4861-40f3-9df2-f8c5f59d79df';
      const S_HATS = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2F808%20CL-HAT%20%20.mp3?alt=media&token=facd4a85-949e-4bca-86d5-0da27199402d';
      const S_PERCS = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FSHE_Percussion_33.mp3?alt=media&token=ca7af384-e47c-43af-8a69-7533c512d489';
      const S_MISC = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2Foooh.mp3?alt=media&token=82c3e18f-c7e0-458b-93d3-09c00a9fe6a1';
      const S_DUBSTEP = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FDubstep%20One%20Shot%2014%20-%20E.mp3?alt=media&token=6862850e-7434-451b-80d7-8b6f063295eb';
      const S_CLAVES = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FClaves.mp3?alt=media&token=1162b3f6-19d7-4a41-a3b6-9c243cd5d36a';

      const LAZER1 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FLazer%2FLazer%20001.mp3?alt=media&token=b73ec61d-740b-42f3-b5a3-41a44e2f4fee';
      const LAZER2 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FLazer%2FLazer%200010.mp3?alt=media&token=48271588-84b9-43be-acad-d9f6d8e38faf';
      const LAZER3 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FLazer%2FLazer%20006.mp3?alt=media&token=848197cf-a315-4aca-82ad-ec10828a1872';
      const LAZER4 = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FLazer%2FLazer%20Digitalo.mp3?alt=media&token=60e9536d-00e4-4fdd-805b-9268d9a7b339';

      const VINYL_BG = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/games%2Fstrassen%20ecke%20im%20hiphop%20style%20mit%20einem%20ghettoblaster%20unten%20aber%20ohne%20leute.jpg?alt=media&token=07390b34-9c29-4334-b810-a0a1ae10c596';

      // 1. Patterns
      const patterns = [
        { id: 'kick-intro-1', data: { id: 'kick-intro-1', name: 'Intro 8-Bar Kick', steps: [0, 16, 32, 48, 64, 80, 96, 112] } },
        { id: 'kick-verse-2', data: { id: 'kick-verse-2', name: 'Verse 2-Shot', steps: Array.from({length: 128}, (_, i) => i % 8 === 0 ? i : -1).filter(v => v !== -1) } }, 
        { id: 'kick-refrain-4', data: { id: 'kick-refrain-4', name: 'Refrain 4-Shot', steps: Array.from({length: 128}, (_, i) => i % 4 === 0 ? i : -1).filter(v => v !== -1) } }, 
        { id: 'kick-hiphop-sync', data: { id: 'kick-hiphop-sync', name: 'HipHop Sync', steps: Array.from({length: 8}, (_, bar) => [0, 6, 10, 14].map(s => s + bar * 16)).flat() } },
        { id: 'kick-buildup-fast', data: { id: 'kick-buildup-fast', name: 'Buildup Fast', steps: [0, 4, 8, 12, 16, 18, 20, 22, 24, 26, 28, 30, ...Array.from({length: 32}, (_, i) => i + 32)] } },
        { id: 'kick-techno-4-4', data: { id: 'kick-techno-4-4', name: 'Techno 4-on-Floor', steps: Array.from({length: 8}, (_, bar) => [0, 4, 8, 12].map(s => s + bar * 16)).flat() } },
        { id: 'clap-basic', data: { id: 'clap-basic', name: 'Clap 2-4', steps: Array.from({length: 8}, (_, bar) => [4, 12].map(s => s + bar * 16)).flat() } },
        { id: 'clap-sync', data: { id: 'clap-sync', name: 'Clap Sync', steps: Array.from({length: 8}, (_, bar) => [4, 11, 14].map(s => s + bar * 16)).flat() } },
        { id: 'hats-basic', data: { id: 'hats-basic', name: 'Hats 4th', steps: Array.from({length: 128}, (_, i) => i % 4 === 0 ? i : -1).filter(v => v !== -1) } },
        { id: 'hats-fast', data: { id: 'hats-fast', name: 'Hats 8th', steps: Array.from({length: 128}, (_, i) => i % 2 === 0 ? i : -1).filter(v => v !== -1) } },
        { id: 'misc-accent', data: { id: 'misc-accent', name: 'Misc Accent', steps: [15, 31, 47, 63, 79, 95, 111, 127] } }
      ];
      for (const p of patterns) {
        setDoc(doc(db, 'patterns', p.id), p.data, { merge: true });
      }

      // 2. Studios
      const studios: Studio[] = [
        { id: 'std-gabriel', name: 'Gabriel Beats', description: 'Handcrafted signature sounds.', coverColor: '#FF9100', district: 'Creative Hub', tags: ['Hip-Hop', 'Electro'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FGabriel%20Studio.png?alt=media&token=2f1e1b66-7f23-461b-9377-f738ea0ce79f' },
        { id: 'std-nintu', name: 'Nintu Music', description: 'Deep melodic explorations.', coverColor: '#993DEB', district: 'Melody District', tags: ['Hip-Hop', 'Electro'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2Fstudioo.png?alt=media&token=9a547bdf-a3bf-4a9a-a132-222383e88b1f' },
        { id: 'std-yoan', name: 'Yoan Beats', description: 'Raw urban textures.', coverColor: '#3838FA', district: 'Underground', tags: ['Hip-Hop', 'Electro'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FYoan%20Beats.png?alt=media&token=984099f0-f45b-4836-81d0-35241d774d83' },
        { id: 'std-dave', name: 'Dave Beats', description: 'Dave Beats is smarter than you think.', coverColor: '#EB3D99', district: 'The Lab', tags: ['Hip-Hop', 'Electro'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2Fstudio%202.png?alt=media&token=96cb0afc-36e3-4c58-8e5d-45a68cd4673a' },
        { id: 'std-noxxos', name: 'Noxxos', description: 'Futuristic club anthems.', coverColor: '#FF3D00', district: 'Skyline', tags: ['Hip-Hop', 'Electro'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FNoxxos%20Studio.png?alt=media&token=fa9f78bc-965b-4af2-bfde-4f0383a87d98' }
      ];
      for (const s of studios) {
        setDoc(doc(db, 'studios', s.id), s, { merge: true });
      }

      // 3. Tracks
      const tracks: Track[] = [
        { id: 'tr-d1', studioId: 'std-dave', name: 'Freestyle', author: 'Dave', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FDave%20Beats%2FDavid%20ist%20Schlau%20aber%20Merlin%20ist%20Ganz%20Ganz%20Ganz%20Dummmmmmm%20120%20bpm.mp3?alt=media&token=fd38176e-faaf-4465-872a-1847f5b37960' },
        { id: 'tr-d2', studioId: 'std-dave', name: 'Anthem', author: 'Dave', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FDave%20Beats%2FDavid%20Komposition.mp3?alt=media&token=4f6a397f-10d4-4fbd-8f13-47cfc9d89d86' },
        { id: 'tr-d3', studioId: 'std-dave', name: 'Hallo Django', author: 'Dave', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FDave%20Beats%2FDavid%20Below%20-%20Hallo%20Django.mp3?alt=media&token=df9d3356-f1f5-4f55-83b1-5d1ec6ac1fbc' },
        { id: 'tr-y1', studioId: 'std-yoan', name: 'Sampling', author: 'Yoan', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FYoan%20Beats%2Fsampling%20125bpm%20260303.mp3?alt=media&token=66d7c77c-088e-4cfe-9bdc-85476bd749ad' },
        { id: 'tr-y2', studioId: 'std-yoan', name: 'Erstes', author: 'Yoan', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FYoan%20Beats%2FErstes%20Yoan%2094bpm%20Amajor%20250425.mp3?alt=media&token=0af91c3b-ae8c-4816-88ed-8bf0814d20a2' },
        { id: 'tr-y3', studioId: 'std-yoan', name: 'Zweites', author: 'Yoan', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FYoan%20Beats%2Fzweites%20yoan.mp3?alt=media&token=7f93d419-707f-421a-8443-b442203be6ec' },
        { id: 'tr-y4', studioId: 'std-yoan', name: 'Yoan Power', author: 'Yoan', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FYoan%20Beats%2FYOAN%20Power%20260312.mp3?alt=media&token=8bb23617-b47d-4584-a658-13b53210b566' },
        { id: 'tr-n1', studioId: 'std-noxxos', name: 'One', author: 'Noxxos', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FNoxxos%2FNoxxos%20One%20Master.mp3?alt=media&token=9ecc6a73-e45d-4f55-8e4b-cbc873474002' },
        { id: 'tr-n2', studioId: 'std-noxxos', name: 'Apple', author: 'Noxxos', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FNoxxos%2FNoxxos%20-%20Apple.mp3?alt=media&token=3ecfffc6-b32d-44c4-97a0-80d15c7f1d49' },
        { id: 'tr-g5', studioId: 'std-gabriel', name: 'Track 5', author: 'Gabriel', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FGabriel%20Beats%2FGabriel%208%20160bpm.mp3?alt=media&token=385d3a0c-c51c-4801-8ec4-18b0f9eedf2f' }
      ];
      for (const t of tracks) {
        setDoc(doc(db, 'tracks', t.id), t, { merge: true });
      }

      // 4. Games
      const gameConfigs = [
        { type: 'rhythm-producer' as const, name: 'BEAT HERO' },
        { type: 'sample-hunter' as const, name: 'VINYL HUNTER' },
        { type: 'sample-catcher' as const, name: 'SAMPLE CATCHER' }
      ];

      for (const s of studios) {
        for (const config of gameConfigs) {
          const gameId = `${s.id}-${config.type}`;
          const isBeatHero = config.type === 'rhythm-producer';
          const isVinylHunter = config.type === 'sample-hunter';
          const isSampleCatcher = config.type === 'sample-catcher';
          
          let gameBpm = 128;
          let gameBackingUrl = '';
          
          if (s.id === 'std-dave') {
            gameBpm = 120;
            if (isBeatHero) gameBackingUrl = tracks.find(t => t.id === 'tr-d1')?.url || '';
            else if (isVinylHunter) gameBackingUrl = tracks.find(t => t.id === 'tr-d2')?.url || '';
            else if (isSampleCatcher) gameBackingUrl = tracks.find(t => t.id === 'tr-d3')?.url || '';
          } else if (s.id === 'std-yoan') {
            if (isBeatHero) { gameBpm = 125; gameBackingUrl = tracks.find(t => t.id === 'tr-y1')?.url || ''; }
            else if (isVinylHunter) { gameBpm = 94; gameBackingUrl = tracks.find(t => t.id === 'tr-y2')?.url || ''; }
            else { gameBpm = 120; gameBackingUrl = tracks.find(t => t.id === 'tr-y3')?.url || ''; }
          } else if (s.id === 'std-noxxos') {
            gameBpm = 156;
            if (isBeatHero || isSampleCatcher) gameBackingUrl = tracks.find(t => t.id === 'tr-n2')?.url || '';
            else if (isVinylHunter) gameBpm = 128, gameBackingUrl = tracks.find(t => t.id === 'tr-n1')?.url || '';
          } else if (s.id === 'std-gabriel') {
            if (isSampleCatcher) {
              gameBpm = 160;
              gameBackingUrl = tracks.find(t => t.id === 'tr-g5')?.url || '';
            }
          }

          setDoc(doc(db, 'games', gameId), {
            id: gameId, studioId: s.id, name: config.name, type: config.type,
            difficulty: 1, minRole: 'free', bpm: gameBpm,
            backingTrackUrl: gameBackingUrl, backgroundImageUrl: isVinylHunter ? VINYL_BG : ''
          }, { merge: true });

          for (let i = 1; i <= 4; i++) {
            const levelId = `${gameId}-lvl${i}`;
            setDoc(doc(db, 'levels', levelId), { id: levelId, gameId, difficulty: i, name: `Level ${i}` }, { merge: true });

            if (isBeatHero) {
              const kickPatterns = s.id === 'std-dave' ? ['kick-hiphop-sync', 'kick-buildup-fast', 'kick-techno-4-4'] : ['kick-intro-1', 'kick-verse-2', 'kick-refrain-4'];
              setDoc(doc(db, 'levels', levelId, 'sounds', `${levelId}-kick`), { id: `${levelId}-kick`, levelId, type: 'kick', sampleUrl: S_KICK, patternIds: kickPatterns }, { merge: true });
              if (i >= 2) setDoc(doc(db, 'levels', levelId, 'sounds', `${levelId}-clap`), { id: `${levelId}-clap`, levelId, type: 'clap', sampleUrl: S_CLAP, patternIds: ['clap-basic', 'clap-sync', 'clap-basic'] }, { merge: true });
              if (i >= 3) setDoc(doc(db, 'levels', levelId, 'sounds', `${levelId}-hats`), { id: `${levelId}-hats`, levelId, type: 'percs', sampleUrl: S_HATS, patternIds: ['hats-basic', 'hats-fast', 'hats-fast'] }, { merge: true });
              if (i === 4) setDoc(doc(db, 'levels', levelId, 'sounds', `${levelId}-misc`), { id: `${levelId}-misc`, levelId, type: 'misc', sampleUrl: S_DUBSTEP, patternIds: ['misc-accent', 'misc-accent', 'misc-accent'] }, { merge: true });
            }

            if (isVinylHunter) {
              const lzs = [LAZER1, LAZER2, LAZER3, LAZER4];
              setDoc(doc(db, 'levels', levelId, 'sounds', `${levelId}-kick`), { id: `${levelId}-kick`, levelId, type: 'kick', sampleUrl: lzs[Math.min(i-1, 3)], patternIds: [] }, { merge: true });
            }

            if (isSampleCatcher) {
              const catchSamples = [S_PERCS, S_CLAP, S_KICK, S_MISC];
              setDoc(doc(db, 'levels', levelId, 'sounds', `${levelId}-catch`), { id: `${levelId}-catch`, levelId, type: 'percs', sampleUrl: catchSamples[i-1] || S_PERCS, patternIds: [] }, { merge: true });
            }
          }
        }
      }

      // 5. InApps
      const learnApps: LearnApp[] = [
        { id: 'learn-ear-training', name: 'EAR TRAINING', type: 'ear-training' as const, minRole: 'free' },
        { id: 'learn-rhythm-trainer', name: 'RHYTHM MASTER', type: 'rhythm-trainer' as const, minRole: 'free' }
      ];
      for (const app of learnApps) {
        setDoc(doc(db, 'learnApps', app.id), app, { merge: true });
      }

      toast({ title: "Master Rack Synced!", description: "All modules and sounds are online." });
    } catch (e) {
      toast({ variant: "destructive", title: "Master Sync Failed" });
    }
  };

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
                      <p className="text-sm font-black uppercase italic tracking-tighter leading-none">{user?.displayName || (user?.isAnonymous ? "Guest Mode" : "Music Producer")}</p>
                      <p className="text-[10px] leading-none opacity-40 font-bold uppercase tracking-widest">{user?.email || `ID: ${user?.uid.substring(0, 8)}...`}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem className="focus:bg-primary/20 focus:text-white cursor-pointer py-3" onClick={() => auth && initiateGoogleSignIn(auth)}><LogIn className="mr-2 h-4 w-4" /><span className="font-black uppercase italic tracking-tighter text-xs">Login with Google</span></DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-destructive/20 focus:text-destructive cursor-pointer py-3" onClick={() => auth && initiateSignOut(auth)}><LogOut className="mr-2 h-4 w-4" /><span className="font-black uppercase italic tracking-tighter text-xs">Sign Out</span></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-auto">
            <TabsList className="bg-white/5 border border-white/5 rounded-full p-1 h-12 md:h-14">
              <TabsTrigger value="studios" className="rounded-full px-6 md:px-12 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase italic tracking-tighter transition-all"><LayoutGrid className="w-4 h-4 mr-2 hidden sm:inline" /> Studios</TabsTrigger>
              <TabsTrigger value="learn" className="rounded-full px-6 md:px-12 data-[state=active]:bg-[#00E676] data-[state=active]:text-black font-black uppercase italic tracking-tighter transition-all"><GraduationCap className="w-4 h-4 mr-2 hidden sm:inline" /> Learn</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>
      <main className="relative flex-1 w-full max-w-7xl mx-auto py-6 md:py-10 px-4 md:px-6">
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="studios" className="m-0 focus-visible:ring-0 outline-none">
            {isLoadingStudios ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4"><Loader2 className="w-10 h-10 animate-spin text-primary" /><p className="text-xs md:text-sm font-black uppercase tracking-[0.4em] opacity-30">Connecting to Rack...</p></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                {filteredStudios.map((studio) => {
                  const isLocked = !hasAccess(profile?.role, studio.minRole || 'free');
                  return (
                    <Link key={studio.id} href={isLocked ? '#' : `/studio/${studio.id}`} className={cn("block transform transition-transform hover:scale-[1.03] active:scale-95", isLocked && "cursor-not-allowed")}><StudioCard studio={studio} isLocked={isLocked} /></Link>
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="learn" className="m-0 focus-visible:ring-0 outline-none"><LearnView /></TabsContent>
        </Tabs>
      </main>
      <footer className="sticky bottom-0 p-3 md:p-4 border-t border-white/5 bg-black/95 backdrop-blur-2xl flex justify-between items-center z-50 shrink-0">
        <div className="flex items-center gap-3 opacity-30"><Zap className="w-4 h-4 text-primary" /><span className="text-[10px] md:text-xs uppercase font-black tracking-[0.2em] hidden sm:inline">Modular Rack System Online</span></div>
        <div className="flex items-center gap-4">{isAdmin && (<Button variant="outline" size="sm" onClick={setupStudios} className="bg-[#FFEA00] text-black hover:bg-[#FFEA00]/90 font-black uppercase italic tracking-tighter border-none shadow-[0_0_15px_rgba(255,234,0,0.2)] h-10 md:h-12 px-8 md:px-12 text-sm md:text-base transition-transform active:scale-95"><RefreshCw className="w-4 h-4 md:w-5 md:h-5 mr-3" /> Rack Sync</Button>)}</div>
      </footer>
    </div>
  );
}
