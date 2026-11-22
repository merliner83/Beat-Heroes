'use client';

import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { useUser } from '@/firebase';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export function JoinClassCard() {
  const { user } = useUser();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (!user) return;
    setBusy(true);
    const res = await apiPost<{ className: string; alreadyMember: boolean }>(user, '/api/classes/join', { code });
    setBusy(false);
    if (!res.ok) {
      toast({ variant: 'destructive', title: 'Beitritt fehlgeschlagen', description: res.error });
      return;
    }
    toast({ title: res.data.alreadyMember ? 'Schon dabei' : 'Willkommen!', description: `Klasse ${res.data.className}` });
    setCode('');
  };

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/15 via-black to-black border border-primary/20 space-y-4">
      <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-black text-lg">Klasse beitreten</h3>
            <p className="text-sm text-white/50">Gib den Code ein, den du von deiner Lehrperson bekommen hast.</p>
          </div>
      </div>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="z.B. K7Q2XM"
          className="uppercase tracking-[0.3em] font-black"
          maxLength={10}
          onKeyDown={(e) => e.key === 'Enter' && code.length >= 4 && join()}
        />
        <Button onClick={join} disabled={busy || code.length < 4}>Beitreten</Button>
      </div>
    </div>
  );
}
