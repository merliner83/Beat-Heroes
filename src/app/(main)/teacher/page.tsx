'use client';

import { Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { isStaff } from '@/lib/game/types';
import { TeacherView } from '@/components/teacher/TeacherView';

export default function TeacherPage() {
  const { profile, isUserLoading } = useUser();
  if (isUserLoading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (!isStaff(profile?.role)) return <p className="font-bold text-center py-20">Nur für Lehrpersonen.</p>;
  return <TeacherView />;
}
