'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, GraduationCap, Gamepad2, Mic2, User, ClipboardList, ShieldCheck, Zap, LogIn, LogOut } from 'lucide-react';
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
  { href: '/artists', label: 'Artists', icon: Mic2 },
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

  const allowed = (item: NavItem) =>
    !item.show || (item.show === 'staff' ? isStaff(profile?.role) : isSuperAdmin(profile?.role));
  // Hauptpunkte (Handy unten, max. 5) und Zusatzpunkte für Lehrpersonen/Admins
  const mainItems = NAV.filter((i) => !i.show);
  const extraItems = NAV.filter((i) => i.show && allowed(i));
  const signedIn = !!user && !user.isAnonymous;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 md:px-6 h-16 md:h-20">
          <Link href="/" className="h-display text-2xl md:text-3xl text-gradient shrink-0">
            Beat Heroes
          </Link>

          <nav className="hidden md:flex items-center gap-1 bg-white/5 rounded-full p-1" aria-label="Hauptnavigation">
            {[...mainItems, ...extraItems].map(({ href, label, icon: Icon, show }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? 'page' : undefined}
                className={cn(
                  'items-center gap-2 rounded-full px-3 lg:px-4 h-10 text-sm font-semibold transition-colors',
                  show ? 'hidden xl:flex' : 'flex',
                  isActive(pathname, href) ? 'bg-brand text-white' : 'text-white/70 hover:text-white',
                )}
              >
                <Icon className="w-4 h-4" /> {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {signedIn && (
              <Link href="/me" title="Deine Credits" className="px-3 h-9 rounded-full border border-credit/30 bg-credit/10 flex items-center gap-1.5 hover:bg-credit/20 transition-colors">
                <Zap className="w-4 h-4 text-credit" fill="currentColor" />
                <span className="font-bold text-sm tabular-nums">{(profile?.streetCred || 0).toLocaleString('de-CH')}</span>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 w-10 rounded-full p-0 border border-white/10" aria-label="Konto">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={user?.photoURL || undefined} />
                    <AvatarFallback className="bg-brand/20 text-brand font-bold">
                      {user?.displayName?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-black/90 border-white/10 text-white backdrop-blur-xl">
                {signedIn ? (
                  <>
                    {(profile?.displayName || user?.displayName) && (
                      <div className="px-2 py-1.5 text-sm text-white/60 truncate max-w-56">{profile?.displayName || user?.displayName}</div>
                    )}
                    {extraItems.map(({ href, label, icon: Icon }) => (
                      <DropdownMenuItem key={href} asChild className="cursor-pointer">
                        <Link href={href}><Icon className="mr-2 h-4 w-4" /> {label}</Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem onClick={() => auth && initiateSignOut(auth)} className="cursor-pointer text-destructive">
                      <LogOut className="mr-2 h-4 w-4" /> Abmelden
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => auth && initiateGoogleSignIn(auth)} className="cursor-pointer">
                      <LogIn className="mr-2 h-4 w-4" /> Mit Google anmelden
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEmailOpen(true)} className="cursor-pointer">
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

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 flex justify-around pb-[env(safe-area-inset-bottom)]" aria-label="Hauptnavigation">
        {mainItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium',
              isActive(pathname, href) ? 'text-brand' : 'text-white/60',
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
