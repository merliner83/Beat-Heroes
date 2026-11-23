'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { collection, doc, getDocs, query, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, ShieldCheck, School as SchoolIcon, Users, BookOpen, Wrench, Download, Upload, RefreshCw } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Article, School, UserProfile, UserRole, isSuperAdmin, normalizeRole } from '@/lib/game/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PathsEditor } from '@/components/admin/PathsEditor';

const ROLE_LABEL: Record<UserRole, string> = {
  student: 'Schüler:in',
  teacher: 'Lehrperson',
  schoolAdmin: 'Schul-Admin',
  superAdmin: 'Super-Admin',
};

function slugify(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3"><Icon className="w-5 h-5 text-primary" /><h2 className="text-xs font-black uppercase tracking-[0.4em] text-white/60">{title}</h2></div>
      {children}
    </section>
  );
}

function SchoolsSection({ schools }: { schools: School[] | null }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [name, setName] = useState('');

  const create = async () => {
    const slug = slugify(name);
    if (!db || !slug) return;
    try {
      await setDoc(doc(db, 'schools', slug), { name: name.trim(), slug, createdAt: serverTimestamp() });
      toast({ title: 'Schule angelegt', description: name });
      setName('');
    } catch {
      toast({ variant: 'destructive', title: 'Anlegen fehlgeschlagen' });
    }
  };

  return (
    <Section icon={SchoolIcon} title="Schulen">
      <div className="flex gap-2 max-w-xl">
        <Input placeholder="Name der Musikschule" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={create} disabled={!slugify(name)}>Anlegen</Button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {schools?.map((s) => (
          <div key={s.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <p className="font-bold">{s.name}</p>
            <p className="text-xs text-white/40">{s.id}</p>
          </div>
        ))}
        {schools?.length === 0 && <p className="text-sm text-white/40">Noch keine Schulen.</p>}
      </div>
    </Section>
  );
}

function PeopleSection({ schools }: { schools: School[] | null }) {
  const db = useFirestore();
  const { toast } = useToast();
  const usersQuery = useMemoFirebase(() => (db ? query(collection(db, 'users')) : null), [db]);
  const { data: users } = useCollection<UserProfile>(usersQuery);

  const update = async (uid: string, data: Partial<UserProfile>) => {
    if (!db) return;
    try {
      await setDoc(doc(db, 'users', uid), data, { merge: true });
      toast({ title: 'Gespeichert' });
    } catch {
      toast({ variant: 'destructive', title: 'Speichern fehlgeschlagen' });
    }
  };

  return (
    <Section icon={Users} title="Personen">
      <p className="text-sm text-white/40">Lehrpersonen hier Rolle und Schule geben. Schüler:innen treten selbst per Klassencode bei.</p>
      <div className="space-y-2">
        {users?.map((u) => (
          <div key={u.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{u.displayName || 'Ohne Namen'}</p>
              <p className="text-xs text-white/40 truncate">{u.email}</p>
            </div>
            <Select value={normalizeRole(u.role)} onValueChange={(v) => update(u.id, { role: v as UserRole })}>
              <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={u.schoolId ?? 'none'} onValueChange={(v) => update(u.id, { schoolId: v === 'none' ? null : v })}>
              <SelectTrigger className="md:w-56"><SelectValue placeholder="Schule" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Schule</SelectItem>
                {schools?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ToolsSection() {
  const db = useFirestore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const contentCols = ['studios', 'tracks', 'games', 'learnApps', 'levels', 'patterns', 'learnCategories', 'learnSubCats', 'articles', 'learnQuizzes', 'learnQuizKeys', 'schools'];

  const backup = async () => {
    if (!db) return;
    setBusy('backup');
    try {
      const data: Record<string, unknown[]> = {};
      for (const col of contentCols) {
        const snap = await getDocs(collection(db, col));
        data[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `beatheroes_inhalte_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      toast({ title: 'Backup erstellt' });
    } catch {
      toast({ variant: 'destructive', title: 'Backup fehlgeschlagen' });
    } finally {
      setBusy(null);
    }
  };

  const restore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;
    setBusy('restore');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        for (const [col, items] of Object.entries(data)) {
          if (!contentCols.includes(col) || !Array.isArray(items)) continue;
          for (const item of items as { id?: string }[]) {
            const { id, ...rest } = item;
            if (id) await setDoc(doc(db, col, id), rest, { merge: true });
          }
        }
        toast({ title: 'Wiederhergestellt' });
      } catch {
        toast({ variant: 'destructive', title: 'Wiederherstellen fehlgeschlagen' });
      } finally {
        setBusy(null);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const rackSync = async () => {
    if (!db) return;
    setBusy('sync');
    const cats = [
      { id: 'intro', title: 'Einführung', iconName: 'BookOpen', colorClass: 'text-primary', order: 10 },
      { id: 'daws', title: 'DAWs', iconName: 'Cpu', colorClass: 'text-[#00E676]', order: 20 },
      { id: 'composing', title: 'Composing', iconName: 'Music', colorClass: 'text-[#FFEA00]', order: 30 },
      { id: 'recording', title: 'Recording', iconName: 'Mic2', colorClass: 'text-[#FF3D00]', order: 40 },
      { id: 'effects', title: 'Effekte', iconName: 'Wand2', colorClass: 'text-[#3838FA]', order: 50 },
      { id: 'djing', title: 'DJing', iconName: 'Disc', colorClass: 'text-primary', order: 60 },
      { id: 'social', title: 'Media & Release', iconName: 'Share2', colorClass: 'text-[#00FFFF]', order: 70 },
      { id: 'rights', title: 'Rechte', iconName: 'Scale', colorClass: 'text-[#EB3D99]', order: 80 },
    ];
    try {
      for (const c of cats) await setDoc(doc(db, 'learnCategories', c.id), c, { merge: true });
      toast({ title: 'Kategorien synchronisiert', description: `${cats.length} Einträge` });
    } catch {
      toast({ variant: 'destructive', title: 'Sync fehlgeschlagen' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section icon={Wrench} title="Werkzeuge">
      <div className="flex flex-wrap gap-3">
        <input type="file" ref={fileRef} onChange={restore} className="hidden" accept=".json" />
        <Button variant="outline" onClick={backup} disabled={!!busy}><Download className="w-4 h-4 mr-2" /> Backup Inhalte</Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!!busy}><Upload className="w-4 h-4 mr-2" /> Restore</Button>
        <Button variant="outline" onClick={rackSync} disabled={!!busy}><RefreshCw className={`w-4 h-4 mr-2 ${busy === 'sync' ? 'animate-spin' : ''}`} /> Kategorien-Sync</Button>
      </div>
    </Section>
  );
}

export default function AdminPage() {
  const db = useFirestore();
  const { profile, isUserLoading } = useUser();
  const admin = isSuperAdmin(profile?.role);
  const schoolsQuery = useMemoFirebase(() => (db && admin ? query(collection(db, 'schools')) : null), [db, admin]);
  const { data: schools } = useCollection<School>(schoolsQuery);
  const articlesQuery = useMemoFirebase(() => (db && admin ? query(collection(db, 'articles')) : null), [db, admin]);
  const { data: articles } = useCollection<Article>(articlesQuery);

  if (isUserLoading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (!admin) return <p className="font-bold text-center py-20">Kein Zugriff.</p>;

  return (
    <div className="space-y-12 max-w-5xl">
      <div className="flex items-center gap-4">
        <ShieldCheck className="w-10 h-10 text-primary" />
        <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter">Admin</h1>
      </div>
      <SchoolsSection schools={schools} />
      <PeopleSection schools={schools} />
      <PathsEditor />
      <Section icon={BookOpen} title="Lerninhalte">
        <div className="grid gap-2 md:grid-cols-2">
          {articles?.map((a) => (
            <Link key={a.id} href={`/admin/articles/${a.id}`} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06]">
              <p className="font-bold">{a.title}</p>
              <p className="text-xs text-white/40">{a.categoryId} · {a.youtubeUrls?.length || 0} YouTube</p>
            </Link>
          ))}
        </div>
      </Section>
      <ToolsSection />
    </div>
  );
}
