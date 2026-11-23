# Beat-Heroes – Kontext für Claude

Sprache mit dem Nutzer: Deutsch (Schweiz, kein ß). Shell ist zsh auf macOS:
keine `#`-Kommentare in Befehlen, die der Nutzer kopiert.

## Projekt
- Web-App (Next.js 15, React 19, Tailwind, shadcn/ui), später iOS- und Android-App.
- Ursprünglich in Firebase Studio entstanden (wird am 22.03.2027 abgeschaltet).
  Code liegt jetzt lokal in `~/App-Projekte/Beat-Heroes` und auf GitHub
  `merliner83/Beat-Heroes`.
- Branches: Arbeit in Feature-Branches → PR nach `learn-2.0` (Entwicklung)
  → `learn-2.0` per Fast-Forward nach `main`. **`main` = was live läuft.**
- Live-Deploy aus lokalem Code von `main`:
  `firebase deploy --only firestore,storage,apphosting --project beat-heroes-ch`
  (kein GitHub-Autodeploy). Gemergte Feature-Branches werden gelöscht.
- Dev-Server: `npm run dev` → http://localhost:9002

## Firebase
- **Neu (ab 22.11.2026): Projekt `beat-heroes-ch`**, Firestore `europe-west6`
  (Zürich). Datenmodell und Rollen: `docs/architecture.md`.
- Storage: `beat-heroes-ch.firebasestorage.app` (europe-west6), alle Dateien
  kopiert, URLs in DB und Code umgeschrieben.
- Altes Projekt `studio-7081808686-cc62f` (USA, Alias `legacy`): Billing
  gelöst (23.11.2026), altes Hosting damit offline; nur noch Archiv.
- Ziel: Firebase nur für Auth, Firestore, Storage (+ App Hosting).
- Web-Config fest in `src/firebase/config.ts` (öffentlicher Web-Key, ok).
- `firebase.json` deployt Firestore-Regeln, -Indizes und Storage-Regeln.
- Rollen in `users/{uid}.role` (student/teacher/schoolAdmin/superAdmin), nur
  serverseitig änderbar; `scripts/set-role.mjs`.
- Credits/Fortschritt schreibt nur `POST /api/credits` (Admin SDK).
- Lokal braucht das Admin SDK `gcloud auth application-default login`.
- Hosting: App Hosting Backend `beat-heroes` in `europe-west4` (Zürich nicht
  verfügbar), live: https://beat-heroes--beat-heroes-ch.europe-west4.hosted.app
  Deploy aus lokalem Code: `firebase deploy --only apphosting` (Claude darf
  jederzeit deployen, solange niemand online ist). Kein GitHub-Autodeploy.
- Claude-Vorschau: `.claude/launch.json` startet einen zweiten Dev-Server auf
  Port 9003 mit eigenem Build-Ordner `.next-preview`.

## MV-Übungen (23.11.2026)
- 14 Rhythmus-Übungen (Puls, Backbeat, House, Boom Bap, Trap, Dembow, One Drop,
  Son-/Rumba-Clave, Bossa Nova, Swing, Walzer, Ländler, Marsch) und 3
  Klaviatur-Übungen (Notennamen, Intervalle, Dur/Moll). Details:
  `docs/architecture.md` → MV-Übungen. MV-Kapitel «Grooves der Welt» neu.
- Nächste Ideen: Tonleitern bauen, Akkord-Progressions, Notenschrift,
  alte Games (Beat Hero usw.) auf RhythmGrid/Design umstellen.

## Design-System (23.11.2026)
- Bausteine in `src/components/ds.tsx` (PageHeader, SectionTitle, Panel,
  Chip, Tag, EmptyState, Loading). Farben als Tailwind-Tokens: `brand`,
  `success`, `warning`, `credit`, `info`, `violet` (z.B. `text-success`).
- `.h-display` (fett/kursiv/gross) nur für Titel; `.eyebrow` für Labels;
  Fliesstext und Buttons normal. Mind. 12px, Text mind. `text-white/60`.
- Alles auf Deutsch (Schweiz). Handy-Navigation max. 5 Punkte; Lehrperson/
  Admin im Konto-Menü (Desktop ab xl auch oben).

## Domain
- `beat-heroes.com` + `www` bei Infomaniak; am Backend `beat-heroes`
  angemeldet (23.11.2026). DNS: A → 35.219.200.100 (statt .10), neue
  TXT `fah-claim=016-…`, CNAME `_acme-challenge_…` (Werte via App-Hosting-API
  `…/backends/beat-heroes/domains/<domain>`). Für Login autorisiert.

## Serverseitige Teile (relevant für Hosting und Mobile)
- `src/app/api/proxy-audio/route.ts`: Audio-Proxy gegen CORS, abgesichert per
  Host-Allowlist (eigener Bucket, actions.google.com, plus `AUDIO_PROXY_ALLOWED_HOSTS`).
- `src/ai/` Genkit-Flow `player-performance-feedback` – aktuell nirgends genutzt.

## Vision (Inputs des Nutzers, 22.11.2026)
- Zielgruppe: Schüler:innen von zwei Musikschulen (Pilot), später schweizweit
  bzw. weitere Schulen → mandantenfähig denken (Schule, Klasse, Lehrperson).
- **Profil**: modern, von Schüler:innen selbst gepflegt, eigener öffentlicher
  Webauftritt mit Link; Beats/Tracks/Videos präsentieren (Spotify-, SoundCloud-,
  YouTube-Embeds, eigener Player). Games nicht prominent im Profil.
- **Learning**: Bereich Producing (Struktur begonnen) und später MV
  (Musikverstehen, Grundlagen-Theorie), immer spielerisch mit In-App-Minigames.
- **Games**: eigener Bereich, getrennt von Profilen.
- **Credits**: Motivationssystem über die ganze App (heute `streetCred`).
- **Kollabo**: freie Beats taggen, Übersicht für Rapper:innen; später andere
  Instrumente, In-App-Aufnahmen, Challenges ("wer baut einen Beat daraus?").
- Arbeitsweise: immer gleich live testen; solange niemand online ist, darf
  Claude jederzeit deployen.

## Architekturprüfung (22.11.2026) – Kernbefunde
- Firestore-Regeln: Jede angemeldete Person kann `role` und `streetCred` im
  eigenen User-Dokument setzen und alle Inhalte (Artikel, Levels, …) schreiben.
  User-Liste inkl. E-Mail für alle Angemeldeten lesbar.
- Credits werden im Client vergeben (`increment` in 6 Komponenten).
- Firestore liegt in `nam5` (USA), App Hosting in `us-central1` – für
  Schuldaten Minderjähriger ungünstig; Region einer DB ist nicht änderbar.
- Rollenmodell `free/pro/producer/admin` ist ein Abo-Modell, kein Schulmodell.
- Alles hängt an `/` mit Tabs + localStorage statt an echten Routen.

## Erledigt (22.11.2026, PR `chore/local-setup`)
- Audio-Proxy abgesichert, `firebase.json` + `.firebaserc` ergänzt,
  README, Paketname `beat-heroes`, Firebase-Studio-Reste entfernt/ignoriert.

## Entscheide (22.11.2026)
- Neues Firebase-Projekt in Europa (umgesetzt: `beat-heroes-ch`).
- Öffentliche Profiländerungen gibt eine Lehrperson frei (Entwurf → Freigabe).
- Zuweisungssystem: Lehrpersonen (auch der Nutzer) weisen Aufgaben zu.
- Mobile: zuerst PWA, später Capacitor mit gehosteter App.
- Lektionen frei wählbar; Lernpfade als Vorlagen (z.B. Talentförderung,
  die der Nutzer in der Schweiz offiziell anerkennen lassen kann).
- Lektionen erstellt nur der Nutzer (superAdmin), keine Lehrpersonen-Inhalte.
- Name: «Beat Heroes» (ohne Bindestrich) für Menschen, `beat-heroes` technisch.
- Google-Login per Popup (Redirect scheitert ausserhalb der authDomain).
- Service Worker: Seiten network-first, sonst kommen Deploys nicht an.

## Offene Punkte
1. Phase 0 erledigt (23.11.2026): Auth aktiv, Live-Domain autorisiert,
   Nutzer ist superAdmin, Credits live verifiziert. Noch keine Schulen angelegt
   (Namen der zwei Musikschulen fehlen).
   → Schulen angelegt: `musikschule-bantiger` (Musikschule Bantiger),
   `musikschule-oberemmental` (Musikschule Oberemmental). Nutzer unterrichtet
   an beiden; als superAdmin ohne schoolId wählt er die Schule in `/teacher`. App-Name überall auf «Beat Heroes»
   vereinheitlichen (heute «BeatHero»); technisch `beat-heroes`.
2. ESLint einrichten, dann `ignoreDuringBuilds` entfernen.
3. Phase 1 (Branch `feat/phase1-structure`): erledigt sind Routen mit
   Navigation (`src/app/(main)/`), Name «Beat Heroes», Schulen (Admin),
   Klassen mit Beitrittscode, Zuweisungen + Abgaben + Freigabe (`/teacher`).
   Learn als Kurse (Producing, MV) mit Lernpfaden (Talentförderung) ist
   umgesetzt, siehe `docs/architecture.md`. Lektions-Editor im Admin
   (`/admin/articles/[id]`, `new?course=…&chapter=…`) mit Live-Vorschau,
   Bild-Upload, Übungen, YouTube und Quiz. 4 MV-Entwürfe (minRole teacher,
   `scripts/seed-mv-drafts.mjs`) warten auf Durchsicht durch den Nutzer.
4. Phase 2 umgesetzt: Profil-Editor (`/me`), Freigabe (`/teacher`),
   Artists-Übersicht und öffentliche Seite `/artists/[handle]`. Games-Seite
   zeigt alle Games (3 Spieltypen × Studios + Lern-Games). Hinweis: Games mit
   `studioId` `std-nintu` haben kein Studio-Dokument (Altlast, ausgeblendet).
5. Phase 3: Beat-Börse, Kollabos, Challenges.
