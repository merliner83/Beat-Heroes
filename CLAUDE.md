# Beat-Heroes – Kontext für Claude

Sprache mit dem Nutzer: Deutsch (Schweiz, kein ß). Shell ist zsh auf macOS:
keine `#`-Kommentare in Befehlen, die der Nutzer kopiert.

## Projekt
- Web-App (Next.js 15, React 19, Tailwind, shadcn/ui), später iOS- und Android-App.
- Ursprünglich in Firebase Studio entstanden (wird am 22.03.2027 abgeschaltet).
  Code liegt jetzt lokal in `~/App-Projekte/Beat-Heroes` und auf GitHub
  `merliner83/Beat-Heroes`.
- Aktiver Entwicklungs-Branch: `learn-2.0` (ist vor `main`). Arbeit in
  Feature-Branches, PRs nach `learn-2.0`.
- Dev-Server: `npm run dev` → http://localhost:9002

## Firebase (Projekt `studio-7081808686-cc62f`)
- Ziel: Firebase nur noch für Auth, Firestore und Storage nutzen.
- Web-Config fest in `src/firebase/config.ts` (öffentlicher Web-Key, ok).
- Storage-Bucket `studio-7081808686-cc62f.firebasestorage.app` enthält die Sounds.
- `firestore.rules` im Repo – vor dem ersten Deploy mit der Console abgleichen.
- `firebase.json` deployt bisher nur Firestore-Regeln.
- Aktuelles Hosting: Firebase App Hosting (Backend `studio`, `apphosting.yaml`).

## Serverseitige Teile (relevant für Hosting und Mobile)
- `src/app/api/proxy-audio/route.ts`: Audio-Proxy gegen CORS, abgesichert per
  Host-Allowlist (eigener Bucket, actions.google.com, plus `AUDIO_PROXY_ALLOWED_HOSTS`).
- `src/ai/` Genkit-Flow `player-performance-feedback` – aktuell nirgends genutzt.

## Erledigt (22.11.2026, PR `chore/local-setup`)
- Audio-Proxy abgesichert, `firebase.json` + `.firebaserc` ergänzt,
  README, Paketname `beat-heroes`, Firebase-Studio-Reste entfernt/ignoriert.

## Offene Punkte
1. `storage.rules` 1:1 aus der Firebase Console übernehmen, dann in `firebase.json` aufnehmen.
2. 15 bestehende TypeScript-Fehler beheben (`audio-engine.ts`, `mock-data.ts`,
   `ui/calendar.tsx`); danach `ignoreBuildErrors`/`ignoreDuringBuilds` in
   `next.config.ts` entfernen.
3. Architekturprüfung und Weiterentwicklung nach den Inputs des Nutzers
   (Vision, Features, Mobile-Strategie: Capacitor vs. React Native/Expo;
   Audio-Proxy wäre bei statischem Export/Capacitor durch Storage-CORS zu ersetzen).
4. Hosting-Entscheid: App Hosting behalten oder Alternative.
