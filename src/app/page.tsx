
"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { Studio, Game, Article, Track, hasAccess, LearnApp, TriggerPattern } from '@/lib/game/types';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState('studios');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const savedTab = localStorage.getItem('beathero_active_tab');
    if (savedTab === 'studios' || savedTab === 'learn' || savedTab === 'progress') {
      setActiveTab(savedTab);
    }
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    localStorage.setItem('beathero_active_tab', value);
  };

  const handleScClick = () => {
    handleTabChange('progress');
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

  const filteredStudios = useMemo(() => {
    if (!allStudios) return [];
    return allStudios.sort((a, b) => a.name.localeCompare(b.name));
  }, [allStudios]);

  const handleBackup = async () => {
    if (!db || !isAdmin) return;
    setIsBackingUp(true);
    const backupData: any = {};
    const rootCollections = ['studios', 'tracks', 'games', 'learnApps', 'levels', 'patterns', 'articles', 'users'];

    try {
      for (const colName of rootCollections) {
        const snap = await getDocs(collection(db, colName));
        backupData[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Handle nested sub-collections
        if (colName === 'levels') {
          backupData.sounds = {}; // Map of levelId -> sounds[]
          for (const levelDoc of snap.docs) {
            const soundsSnap = await getDocs(collection(db, 'levels', levelDoc.id, 'sounds'));
            if (!soundsSnap.empty) {
              backupData.sounds[levelDoc.id] = soundsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
          }
        }
        
        if (colName === 'users') {
          backupData.userProgressData = {}; // Map of userId -> { progress: [], patternProgress: [] }
          for (const userDoc of snap.docs) {
            const progressSnap = await getDocs(collection(db, 'users', userDoc.id, 'progress'));
            const patternSnap = await getDocs(collection(db, 'users', userDoc.id, 'patternProgress'));
            
            if (!progressSnap.empty || !patternSnap.empty) {
              backupData.userProgressData[userDoc.id] = {
                progress: progressSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                patternProgress: patternSnap.docs.map(d => ({ id: d.id, ...d.data() }))
              };
            }
          }
        }
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `beathero_full_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ 
        title: "Database Backup Complete!", 
        description: "Entire dataset has been exported. Choose your location in the browser dialog." 
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Backup Failed", description: "Could not fetch all collections." });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !db || !isAdmin) return;

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        let restoreCount = 0;

        const rootCollections = ['studios', 'tracks', 'games', 'learnApps', 'levels', 'patterns', 'articles', 'users'];
        for (const col of rootCollections) {
          if (data[col] && Array.isArray(data[col])) {
            for (const item of data[col]) {
              const { id, ...docData } = item;
              if (id) {
                await setDoc(doc(db, col, id), docData, { merge: true });
                restoreCount++;
              }
            }
          }
        }

        // Restore Sounds (Levels Sub-collection)
        if (data.sounds) {
          for (const [levelId, levelSounds] of Object.entries(data.sounds)) {
            if (Array.isArray(levelSounds)) {
              for (const sound of levelSounds) {
                const { id, ...soundData } = sound;
                if (id) {
                  await setDoc(doc(db, 'levels', levelId, 'sounds', id), soundData, { merge: true });
                  restoreCount++;
                }
              }
            }
          }
        }

        // Restore User Progress (Users Sub-collections)
        if (data.userProgressData) {
          for (const [userId, userStore] of Object.entries(data.userProgressData)) {
            const typedStore = userStore as any;
            if (typedStore.progress && Array.isArray(typedStore.progress)) {
              for (const p of typedStore.progress) {
                const { id, ...pData } = p;
                if (id) {
                  await setDoc(doc(db, 'users', userId, 'progress', id), pData, { merge: true });
                  restoreCount++;
                }
              }
            }
            if (typedStore.patternProgress && Array.isArray(typedStore.patternProgress)) {
              for (const pp of typedStore.patternProgress) {
                const { id, ...ppData } = pp;
                if (id) {
                  await setDoc(doc(db, 'users', userId, 'patternProgress', id), ppData, { merge: true });
                  restoreCount++;
                }
              }
            }
          }
        }

        toast({ title: "Full Restore Successful", description: `${restoreCount} entries updated from backup.` });
      } catch (err) {
        toast({ variant: "destructive", title: "Restore Failed", description: "Invalid backup format." });
      } finally {
        setIsRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const setupStudios = async () => {
    if (!db) return;
    setIsSyncing(true);
    let createdCount = 0;
    let verifiedCount = 0;
    let fixedCount = 0;

    const syncItem = async (col: string, id: string, localData: any) => {
      const ref = doc(db, col, id);
      const snap = await getDoc(ref);
      
      if (!snap.exists()) {
        await setDoc(ref, localData);
        createdCount++;
      } else {
        const firestoreData = snap.data();
        let needsUpdate = false;
        const updatePayload: any = {};

        const criticalFields = ['backingTrackUrl', 'sampleUrl', 'url', 'bpm', 'type', 'subCategoryId', 'subCategoryTitle', 'subCategoryIconUrl'];
        
        for (const field of criticalFields) {
          if (localData[field] && !firestoreData[field]) {
            updatePayload[field] = localData[field];
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await setDoc(ref, updatePayload, { merge: true });
          fixedCount++;
        } else {
          verifiedCount++;
        }
      }
    };

    try {
      const S_KICK = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FKICK1.mp3?alt=media&token=23415b38-2c12-4462-bb74-385533ad1c57';
      const S_CLAP = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FClap%201.mp3?alt=media&token=59073468-4861-40f3-9df2-f8c5f59d79df';
      const S_HATS = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2F808%20CL-HAT%20%20.mp3?alt=media&token=facd4a85-949e-4bca-86d5-0da27199402d';
      const S_DUBSTEP = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FDubstep%20One%20Shot%2014%20-%20E.mp3?alt=media&token=6862850e-7434-451b-80d7-8b6f063295eb';
      const VINYL_BG = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/games%2Fstrassen%20ecke%20im%20hiphop%20style%20mit%20einem%20ghettoblaster%20unten%20aber%20ohne%20leute.jpg?alt=media&token=07390b34-9c29-4334-b810-a0a1ae10c596';
      const S_CLAVES = 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/sounds%2FClaves.mp3?alt=media&token=1162b3f6-19d7-4a41-a3b6-9c243cd5d36a';

      const patternsArr = [
        { id: 'kick-intro-1', name: 'Intro 8-Bar Kick', sampleUrl: S_KICK, steps: [0, 16, 32, 48, 64, 80, 96, 112] },
        { id: 'kick-verse-2', name: 'Verse 2-Shot', sampleUrl: S_KICK, steps: Array.from({length: 128}, (_, i) => i % 8 === 0 ? i : -1).filter(v => v !== -1) }, 
        { id: 'kick-refrain-4', name: 'Refrain 4-Shot', sampleUrl: S_KICK, steps: Array.from({length: 128}, (_, i) => i % 4 === 0 ? i : -1).filter(v => v !== -1) }, 
        { id: 'kick-hiphop-sync', name: 'HipHop Sync', sampleUrl: S_KICK, steps: Array.from({length: 8}, (_, bar) => [0, 6, 10, 14].map(s => s + bar * 16)).flat() },
        { id: 'kick-buildup-fast', name: 'Buildup Fast', sampleUrl: S_KICK, steps: Array.from({length: 4}, (_, bar) => [0, 2, 4, 6, 8, 10, 12, 14].map(s => s + bar * 16)).flat().concat(Array.from({length: 64}, (_, i) => i + 64)) },
        { id: 'kick-techno-4-4', name: 'Techno 4-on-Floor', sampleUrl: S_KICK, steps: Array.from({length: 8}, (_, bar) => [0, 4, 8, 12].map(s => s + bar * 16)).flat() },
        { id: 'clap-basic', name: 'Clap 2-4', sampleUrl: S_CLAP, steps: Array.from({length: 8}, (_, bar) => [4, 12].map(s => s + bar * 16)).flat() },
        { id: 'clap-sync', name: 'Clap Sync', sampleUrl: S_CLAP, steps: Array.from({length: 8}, (_, bar) => [4, 11, 14].map(s => s + bar * 16)).flat() },
        { id: 'hats-basic', name: 'Hats 4th', sampleUrl: S_HATS, steps: Array.from({length: 128}, (_, i) => i % 4 === 0 ? i : -1).filter(v => v !== -1) },
        { id: 'hats-fast', name: 'Hats 8th', sampleUrl: S_HATS, steps: Array.from({length: 128}, (_, i) => i % 2 === 0 ? i : -1).filter(v => v !== -1) },
        { id: 'clave-latin', name: 'Clave Latin', sampleUrl: S_CLAVES, steps: [0, 3, 6, 10, 12] }
      ];
      for (const p of patternsArr) await syncItem('patterns', p.id, p);

      const studios: Studio[] = [
        { id: 'std-gabriel', name: 'Gabriel Beats', description: 'Handcrafted signature sounds.', coverColor: '#FF9100', district: 'Creative Hub', tags: ['Hip-Hop', 'Electro'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FGabriel%20Studio.png?alt=media&token=2f1e1b66-7f23-461b-9377-f738ea0ce79f' },
        { id: 'std-nintu', name: 'Nintu Music', description: 'Deep melodic explorations.', coverColor: '#993DEB', district: 'Melody District', tags: ['Hip-Hop', 'Electro'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2Fstudioo.png?alt=media&token=9a547bdf-a3bf-4a9a-a132-222383e88b1f' },
        { id: 'std-yoan', name: 'Yoan Beats', description: 'Raw urban textures.', coverColor: '#3838FA', district: 'Underground', tags: ['Hip-Hop', 'Electro'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FYoan%20Beats.png?alt=media&token=984099f0-f45b-4836-81d0-35241d774d83' },
        { id: 'std-dave', name: 'Dave Beats', description: 'Dave Beats is smarter than you think.', coverColor: '#EB3D99', district: 'The Lab', tags: ['Hip-Hop', 'Electro'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2Fstudio%202.png?alt=media&token=96cb0afc-36e3-4c58-8e5d-45a68cd4673a' },
        { id: 'std-noxxos', name: 'Noxxos', description: 'Futuristic club anthems.', coverColor: '#FF3D00', district: 'Skyline', tags: ['Hip-Hop', 'Electro'], minRole: 'free', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FNoxxos%20Studio.png?alt=media&token=fa9f78bc-965b-4af2-bfde-4f0383a87d98' }
      ];
      for (const s of studios) await syncItem('studios', s.id, s);

      const tracks: Track[] = [
        { id: 'tr-g1', studioId: 'std-gabriel', name: 'Track 1', author: 'Gabriel', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FGabriel%20Beats%2FGabriel%201_140bpm.mp3?alt=media&token=0d094a95-7a8c-40a4-8e17-c1eebf721540' },
        { id: 'tr-g2', studioId: 'std-gabriel', name: 'Track 2', author: 'Gabriel', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FGabriel%20Beats%2FGabriel%202_148bpm.mp3?alt=media&token=1f877a36-c331-4286-97ce-aad7f1edf807' },
        { id: 'tr-g3', studioId: 'std-gabriel', name: 'Track 3', author: 'Gabriel', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FGabriel%20Beats%2Fgabriel%204%20150bpm%20scratch.mp3?alt=media&token=d4a447a1-5c31-4aeb-acab-146fccc039b8' },
        { id: 'tr-d1', studioId: 'std-dave', name: 'Freestyle', author: 'Dave', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FDave%20Beats%2FDavid%20ist%20Schlau%20aber%20Merlin%20ist%20Ganz%20Ganz%20Ganz%20Dummmmmmm%20120%20bpm.mp3?alt=media&token=fd38176e-faaf-4465-872a-1847f5b37960' },
        { id: 'tr-y1', studioId: 'std-yoan', name: 'Sampling', author: 'Yoan', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FYoan%20Beats%2Fsampling%20125bpm%20260303.mp3?alt=media&token=66d7c77c-088e-4cfe-9bdc-85476bd749ad' },
        { id: 'tr-y2', studioId: 'std-yoan', name: 'Erstes', author: 'Yoan', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FYoan%20Beats%2FErstes%20Yoan%2094bpm%20Amajor%20250425.mp3?alt=media&token=0af91c3b-ae8c-4816-88ed-8bf0814d20a2' },
        { id: 'tr-n1', studioId: 'std-noxxos', name: 'One', author: 'Noxxos', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FNoxxos%2FNoxxos%20One%20Master.mp3?alt=media&token=9ecc6a73-e45d-4f55-8e4b-cbc873474002' },
        { id: 'tr-n2', studioId: 'std-noxxos', name: 'Apple', author: 'Noxxos', url: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/tracks%2FNoxxos%2FNoxxos%20-%20Apple.mp3?alt=media&token=3ecfffc6-b32d-44c4-97a0-80d15c7f1d49' }
      ];
      for (const t of tracks) await syncItem('tracks', t.id, t);

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
          
          let gameBpm = 128;
          let gameBackingUrl = '';
          
          if (s.id === 'std-noxxos') {
            gameBpm = 128;
            if (isBeatHero) gameBackingUrl = tracks.find(t => t.id === 'tr-n1')?.url || '';
            else if (isVinylHunter) gameBackingUrl = tracks.find(t => t.id === 'tr-n2')?.url || '';
            else gameBackingUrl = tracks.find(t => t.id === 'tr-n1')?.url || '';
          } else if (s.id === 'std-dave') {
            gameBpm = 120;
            gameBackingUrl = tracks.find(t => t.id === 'tr-d1')?.url || '';
          } else if (s.id === 'std-yoan') {
            gameBpm = isBeatHero ? 125 : isVinylHunter ? 94 : 120;
            gameBackingUrl = isBeatHero ? tracks.find(t => t.id === 'tr-y1')?.url || '' : tracks.find(t => t.id === 'tr-y2')?.url || '';
          } else if (s.id === 'std-gabriel') {
            gameBpm = isBeatHero ? 148 : isVinylHunter ? 150 : 160;
            gameBackingUrl = isBeatHero ? tracks.find(t => t.id === 'tr-g2')?.url || '' : tracks.find(t => t.id === 'tr-g3')?.url || '';
          } else {
            gameBpm = 120;
            gameBackingUrl = tracks.find(t => t.id === 'tr-d1')?.url || '';
          }

          await syncItem('games', gameId, {
            id: gameId, studioId: s.id, name: config.name, type: config.type,
            difficulty: 1, minRole: 'free', bpm: gameBpm,
            backingTrackUrl: gameBackingUrl, backgroundImageUrl: isVinylHunter ? VINYL_BG : ''
          });

          for (let i = 1; i <= 4; i++) {
            const levelId = `${gameId}-lvl${i}`;
            await syncItem('levels', levelId, { id: levelId, gameId, difficulty: i, name: `Level ${i}` });
            if (isBeatHero) {
              const kickPatterns = s.id === 'std-dave' ? ['kick-hiphop-sync', 'kick-buildup-fast', 'kick-techno-4-4'] : ['kick-intro-1', 'kick-verse-2', 'kick-refrain-4'];
              await syncItem('levels/' + levelId + '/sounds', `${levelId}-kick`, { id: `${levelId}-kick`, levelId, type: 'kick', sampleUrl: S_KICK, patternIds: kickPatterns });
              if (i >= 2) await syncItem('levels/' + levelId + '/sounds', `${levelId}-clap`, { id: `${levelId}-clap`, levelId, type: 'clap', sampleUrl: S_CLAP, patternIds: ['clap-basic', 'clap-sync', 'clap-sync'] });
              if (i >= 3) await syncItem('levels/' + levelId + '/sounds', `${levelId}-hats`, { id: `${levelId}-hats`, levelId, type: 'percs', sampleUrl: S_HATS, patternIds: ['hats-basic', 'hats-fast', 'hats-fast'] });
              if (i === 4) await syncItem('levels/' + levelId + '/sounds', `${levelId}-misc`, { id: `${levelId}-misc`, levelId, type: 'misc', sampleUrl: S_DUBSTEP, patternIds: ['misc-accent', 'misc-accent', 'misc-accent'] });
            }
          }
        }
      }

      await syncItem('learnApps', 'learn-ear-training', { id: 'learn-ear-training', name: 'EAR TRAINING', type: 'ear-training', minRole: 'free' });
      await syncItem('learnApps', 'learn-rhythm-trainer', { id: 'learn-rhythm-trainer', name: 'RHYTHM MASTER', type: 'rhythm-trainer', minRole: 'free' });

      // DAW Articles Sync
      const daws = [
        { id: 'gb', title: 'GarageBand', icon: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FGabriel%20Studio.png?alt=media&token=2f1e1b66-7f23-461b-9377-f738ea0ce79f' },
        { id: 'cb', title: 'Cubase', icon: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FNoxxos%20Studio.png?alt=media&token=fa9f78bc-965b-4af2-bfde-4f0383a87d98' },
        { id: 'lp', title: 'Logic Pro', icon: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2FYoan%20Beats.png?alt=media&token=984099f0-f45b-4836-81d0-35241d774d83' },
        { id: 'ab', title: 'Ableton Live', icon: 'https://firebasestorage.googleapis.com/v0/b/studio-7081808686-cc62f.firebasestorage.app/o/studios%2Fstudioo.png?alt=media&token=9a547bdf-a3bf-4a9a-a132-222383e88b1f' }
      ];

      const topics = [
        { id: 'basics', title: 'Basics' },
        { id: 'shortcuts', title: 'Shortcuts' },
        { id: 'vocal', title: 'Vocal Chain' },
        { id: 'mastering', title: 'Mastering Chain' }
      ];

      for (const daw of daws) {
        for (const topic of topics) {
          const artId = `art-${daw.id}-${topic.id}`;
          await syncItem('articles', artId, {
            id: artId,
            categoryId: 'daws',
            subCategoryId: daw.id,
            subCategoryTitle: daw.title,
            subCategoryIconUrl: daw.icon,
            title: `${daw.title}: ${topic.title}`,
            content: `Hier erfährst du alles über ${topic.title} in ${daw.title}.\n\n# Die Grundlagen\nStarte jetzt dein Projekt und meistere den Workflow.`,
            minRole: 'free'
          });
        }
      }

      toast({ 
        title: "Master Rack Synced!", 
        description: `Stats: ${createdCount} created, ${fixedCount} repaired, ${verifiedCount} verified.` 
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Master Sync Failed" });
    } finally {
      setIsSyncing(false);
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
              <div 
                onClick={handleScClick}
                className="flex gemini-border gemini-glow-accent p-1 px-3 md:p-1.5 md:px-6 bg-black/80 backdrop-blur-3xl border border-white/5 shrink-0 cursor-pointer hover:scale-105 transition-transform active:scale-95"
              >
                <div className="text-white font-black text-sm md:text-3xl leading-none tracking-tighter flex items-center gap-1.5 md:gap-2">
                  <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#FFEA00]" fill="currentColor" />
                  {streetCred.toLocaleString()} <span className="text-primary italic font-black text-[10px] md:text-base">SC</span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 md:h-12 md:w-12 rounded-full p-0 border border-white/10 hover:bg-white/5">
                    <Avatar className="h-10 w-10 md:h-12 md:w-12">
                      <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "User"} />
                      <AvatarFallback className="bg-primary/20 text-primary font-black">
                        {user?.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="w-5 h-5 md:w-6 md:h-6" />}
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
          <TabsContent value="progress" className="m-0 focus-visible:ring-0 outline-none"><ProfileView /></TabsContent>
        </Tabs>
      </main>
      <footer className="sticky bottom-0 p-3 md:p-4 border-t border-white/5 bg-black/95 backdrop-blur-2xl flex justify-between items-center z-50 shrink-0">
        <div className="flex items-center gap-3 opacity-30"><Zap className="w-4 h-4 text-primary" /><span className="text-[10px] md:text-xs uppercase font-black tracking-[0.2em] hidden sm:inline">Modular Rack System Online</span></div>
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar">
          {isAdmin && (
            <div className="flex gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleRestore} 
                accept=".json" 
                className="hidden" 
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isRestoring || isSyncing || isBackingUp} 
                className="bg-white/5 text-white hover:bg-white/10 font-black uppercase italic tracking-tighter border-white/10 h-10 md:h-12 px-4 md:px-6 transition-transform active:scale-95"
              >
                {isRestoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Restore
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBackup} 
                disabled={isBackingUp || isSyncing || isRestoring} 
                className="bg-white/5 text-white hover:bg-white/10 font-black uppercase italic tracking-tighter border-white/10 h-10 md:h-12 px-4 md:px-6 transition-transform active:scale-95"
              >
                {isBackingUp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Backup
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={setupStudios} 
                disabled={isSyncing || isBackingUp || isRestoring} 
                className="bg-[#FFEA00] text-black hover:bg-[#FFEA00]/90 font-black uppercase italic tracking-tighter border-none shadow-[0_0_15px_rgba(255,234,0,0.2)] h-10 md:h-12 px-6 md:px-10 text-xs md:text-sm transition-transform active:scale-95"
              >
                {isSyncing ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 md:w-5 md:h-5 mr-2" />}
                Rack Sync
              </Button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
