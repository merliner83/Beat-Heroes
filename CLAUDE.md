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
Stand 24.11.2026. Phasen 0–2 sind live (Auth, Rollen, Schulen
`musikschule-bantiger` und `musikschule-oberemmental`, Klassen, Zuweisungen,
Kurse mit Lernpfaden, Lektions-Editor, Profile mit Freigabe, Games-Seite).
Superadmin ohne `schoolId` wählt die Schule in `/teacher`.
1. MV hat 4 freigeschaltete Lektionen (Puls/Takt/BPM, Notenwerte, Offbeats/
   Swing, Klaviatur; 24.11.2026). Weitere Kapitel (Tonleitern, Akkorde, Melodie,
   Form) haben noch keine Lektionen.
2. ESLint einrichten, dann `ignoreDuringBuilds` entfernen.
3. Altlast: Games mit `studioId` `std-nintu` haben kein Studio-Dokument
   (ausgeblendet).
4. Vom Nutzer gewählt (24.11.2026), alles gewünscht, eins nach dem anderen:
   - ✅ Schul-Profile + Mehrfach-Schulen + schönere Artist-Profile (Branch
     `feat/schul-profile`, siehe `docs/architecture.md` → Organisation/Profil).
     Logos = Mitgliedschaften (Admin → Personen, Chips pro Schule). Logos und
     Texte der zwei Schulen muss der Nutzer noch im Admin hochladen.
   - ✅ Artikel einfacher: Baustein-Editor mit Vorlagen, Tipp-Box, YouTube-Karte,
     Link-Knopf (24.11.2026).
   - ✅ Neue Lektions-/Kursseite (24.11.2026, PR #8): Fortschritt pro Thema
     statt Credits in Lektionen, «Weitermachen», «Weiter», DAW-Wahl
     (Wahlkapitel, Credits pro Kapitel auf ein DAW begrenzt).
   - Lektionen inhaltlich durchgehen («neu gedacht», siehe Memory):
     Willkommen ✓, Producing ✓, Sampling ✓, Cubase ✓ (4 Lektionen nach
     GarageBand-Vorbild, Screenshots fehlen noch), DJing ✓ (Einführung +
     4 Kapitel-Lektionen), Equipment ✓ (4 Ausbaustufen, Hinweis auf
     StudioSounds Bern zum Monitore-Probehören), MV ✓ (4 Lektionen
     freigeschaltet), Recording ✓ (Basics als Kernlektion + 6 Instrumente
     kompakt), Ableton ✓ (4 Lektionen), Logic ✓ (4 Lektionen, Shortcuts um
     Fenster/Transport ergänzt) + GarageBand Mastering ✓, Effekte ✓
     (26.11.2026: Insert, Send, Kreativ Beats + Vocals, Gratis-Plugins;
     Lektionen in den Unterthemen `sc-ins`/`sc-snd`/`sc-crt`/`sc-free`),
     Composing ✓ + Editing ✓ (26.11.2026: Songwriting, Arrangement, Sound
     Design, Editing als Text statt Grafik; Editing-Kapitel jetzt order 45),
     Rechte ✓ + Media & Release ✓ (26.11.2026: 3 Rechte-Lektionen inkl.
     Samples/Beats/Covers und Split Sheet, Social mit Sicherheit für
     Minderjährige, neue Release-Lektion; Fakten CH: SUISA einmalig CHF 200,
     Swissperform gratis, kein Sampling-Freiraum, Schutz 70 Jahre).
     Damit sind alle Producing-Kapitel einmal «neu gedacht». Weiteres Material im Doc: Monitoring (Recording),
     Abtastrate/Bit-Tiefe, Gruppen-/Ordnerspuren, Social-Texte, Tool-Liste,
     Produktionsvertrag.
     Weiterführende Videos klein als `INSPIRATION:`, nicht gross.
   - DAWs: alle 16 Lektionen haben Inhalt. Leere Lektionen sieht nur der
     superAdmin, sie geben keine Credits (PR #20). Doppelte Shortcuts im
     Kapitel `daw` gelöscht (Backup `backups/…-duplikate`). Kapitel haben
     noch keine Beschriebe.
   - Gratis-Plugins (25./26.11.2026): Unterthema `sc-free` bei Effekte mit
     Flayr Tune, TAL-Filter-2, Kilohearts Essentials, MJUC jr.; verlinkt per
     `PLUGIN:`-Karte (Vocal-Chains, Kreative Effekte). Speedrum/Tonespace
     bewusst nicht (Nutzer sucht Alternativen bzw. veraltet).
   - Cubase Basics mit Screenshots aus dem Google Doc «Producer Guide» des
     Nutzers (Urfassung vieler Lektionen, Bilder via HTML-Export). Keine
     Screenshots von Dialogen, die sich oft ändern (z.B. Hub). Plugin-Fenster
     als `IMAGE: url | Text | klein`.
   - MV ausbauen (Tonleitern, Akkordfolgen, Notenschrift).
   - Alte Games aufs Design-System / RhythmGrid.
   - Offen: Handy-Feedback zu den MV-Übungen (Mitklopfen-Latenz).
5. Phase 3: Beat-Börse, Kollabos, Challenges.
