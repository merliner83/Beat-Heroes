'use client';

import React, { useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { CheckCircle2, MessageSquareWarning, UserRound } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { ProfileDraft, isSuperAdmin } from '@/lib/game/types';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ProfileShowcase } from '@/components/profile/ProfileShowcase';

function ReviewDialog({ draft, onClose }: { draft: ProfileDraft; onClose: () => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const review = async (action: 'approve' | 'changes_requested') => {
    if (!user) return;
    setBusy(true);
    const res = await apiPost(user, '/api/profiles/review', { uid: draft.id, action, note });
    setBusy(false);
    if (!res.ok) {
      toast({ variant: 'destructive', title: 'Fehlgeschlagen', description: res.error });
      return;
    }
    toast({ title: action === 'approve' ? 'Profil veröffentlicht' : 'Zur Überarbeitung zurückgegeben' });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#050505] border-white/10 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Profil prüfen: /artists/{draft.handle}</DialogTitle></DialogHeader>
        <ProfileShowcase profile={draft} />
        <div className="space-y-3 pt-4 border-t border-white/10">
          <p className="text-xs text-white/50">Prüfe Texte, Bild und verlinkte Tracks (Inhalt, Urheberrecht, Persönlichkeitsschutz).</p>
          <Textarea placeholder="Notiz an die Schülerin / den Schüler (bei «Überarbeiten» nötig)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-warning/50 text-warning" disabled={busy || !note.trim()} onClick={() => review('changes_requested')}>
              <MessageSquareWarning className="w-4 h-4 mr-1" /> Überarbeiten
            </Button>
            <Button className="flex-1 bg-success text-black hover:bg-success/90" disabled={busy} onClick={() => review('approve')}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Freigeben
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Eingereichte Profil-Entwürfe einer Schule (Super-Admins sehen auch solche ohne Schule). */
export function ProfileReviews({ schoolId }: { schoolId: string }) {
  const db = useFirestore();
  const { profile } = useUser();
  const [open, setOpen] = useState<ProfileDraft | null>(null);
  const schoolQ = useMemoFirebase(() => (db ? query(collection(db, 'profileDrafts'), where('schoolIds', 'array-contains', schoolId), where('status', '==', 'submitted')) : null), [db, schoolId]);
  const noSchoolQ = useMemoFirebase(() => (db && isSuperAdmin(profile?.role) ? query(collection(db, 'profileDrafts'), where('schoolIds', '==', []), where('status', '==', 'submitted')) : null), [db, profile?.role]);
  const { data: fromSchool } = useCollection<ProfileDraft>(schoolQ);
  const { data: withoutSchool } = useCollection<ProfileDraft>(noSchoolQ);
  const drafts = [...(fromSchool ?? []), ...(withoutSchool ?? [])];

  if (drafts.length === 0) return null;

  return (
    <section className="space-y-3 p-5 rounded-2xl border border-primary/30 bg-primary/5">
      <div className="flex items-center gap-2"><UserRound className="w-5 h-5 text-primary" /><h3 className="text-base font-bold text-white/90">Profil-Freigaben ({drafts.length})</h3></div>
      <div className="grid gap-2 md:grid-cols-2">
        {drafts.map((d) => (
          <button key={d.id} onClick={() => setOpen(d)} className="p-3 rounded-xl bg-black/40 border border-white/10 hover:border-primary/50 text-left flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d.avatarUrl ? <img src={d.avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="font-black">{d.artistName.charAt(0)}</span>}
            </div>
            <div className="min-w-0">
              <p className="font-bold truncate">{d.artistName}</p>
              <p className="text-xs text-white/60 truncate">/artists/{d.handle}{d.schoolIds?.length ? '' : ' · ohne Schule'}</p>
            </div>
          </button>
        ))}
      </div>
      {open && <ReviewDialog draft={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
