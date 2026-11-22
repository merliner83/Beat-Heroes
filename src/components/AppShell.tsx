'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, GraduationCap, Gamepad2, User, ClipboardList, ShieldCheck, Zap, LogIn, LogOut } from 'lucide-react';
import { useUser, useAuth } from '@/firebase';
import { initiateGoogleSignIn, initiateEmailSignIn, initiateEmailSignUp, initiateSignOut } from '@/firebase/non-blocking-login';
import { isStaff, isSuperAdmin } from '@/lib/game/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; show?: 'staff' | 'superAdmin' };

const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/learn', label: 'Lernen', icon: GraduationCap },
  { href: '/games', label: 'Games', icon: Gamepad2 },
  { href: '/me', label: 'Ich', icon: User },
  { href: '/teacher', label: 'Lehrperson', icon: ClipboardList, show: 'staff' },
  { href: '/admin', label: 'Admin', icon: ShieldCheck, show: 'superAdmin' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useAuth();
  const { user, profile } = useUser();
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => { if (user && !user.isAnonymous) setEmailOpen(false); }, [user]);

  const items = NAV.filter((item) =>
    !item.show || (item.show === 'staff' ? isStaff(profile?.role) : isSuperAdmin(profile?.role)),
  );
  const signedIn = !!user && !user.isAnonymous;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 md:px-6 h-16 md:h-20">
          <Link href="/" className="text-2xl md:text-4xl font-black uppercase italic text-gradient tracking-tighter shrink-0">
            Beat Heroes
          </Link>

          <nav className="hidden md:flex items-center gap-1 bg-white/5 rounded-full p-1">
            {items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-full px-4 h-10 text-sm font-black uppercase italic tracking-tighter transition-colors',
                  isActive(pathname, href) ? 'bg-primary text-white' : 'text-white/60 hover:text-white',
                )}
              >
                <Icon className="w-4 h-4" /> {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {signedIn && (
              <Link href="/me" className="gemini-border px-3 py-1.5 bg-black/80 flex items-center gap-2 hover:bg-black transition-colors">
                <Zap className="w-4 h-4 text-[#FFEA00]" fill="currentColor" />
                <span className="font-black italic text-sm">{(profile?.streetCred || 0).toLocaleString('de-CH')} SC</span>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 w-10 rounded-full p-0 border border-white/10" aria-label="Konto">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={user?.photoURL || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary font-black uppercase italic">
                      {user?.displayName?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-black/90 border-white/10 text-white backdrop-blur-xl">
                {signedIn ? (
                  <DropdownMenuItem onClick={() => auth && initiateSignOut(auth)} className="cursor-pointer text-destructive font-bold">
                    <LogOut className="mr-2 h-4 w-4" /> Abmelden
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => auth && initiateGoogleSignIn(auth)} className="cursor-pointer font-bold">
                      <LogIn className="mr-2 h-4 w-4" /> Mit Google anmelden
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEmailOpen(true)} className="cursor-pointer font-bold">
                      <LogIn className="mr-2 h-4 w-4" /> Mit E-Mail anmelden
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto py-6 md:py-10 px-4 md:px-6 pb-28 md:pb-10">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 flex justify-around pb-[env(safe-area-inset-bottom)]">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 px-2 text-[10px] font-black uppercase tracking-tight',
              isActive(pathname, href) ? 'text-primary' : 'text-white/50',
            )}
          >
            <Icon className="w-5 h-5" /> {label}
          </Link>
        ))}
      </nav>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 text-white">
          <DialogHeader><DialogTitle>Mit E-Mail anmelden</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input type="password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="flex gap-3">
              <Button onClick={() => auth && initiateEmailSignIn(auth, email, password)} className="flex-1">Anmelden</Button>
              <Button variant="outline" onClick={() => auth && initiateEmailSignUp(auth, email, password)} className="flex-1">Registrieren</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
