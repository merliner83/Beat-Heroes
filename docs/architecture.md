# Beat-Heroes – Architektur

Stand: 24.11.2026. Lebendes Dokument; bei Änderungen am Datenmodell nachführen.

## Plattform

| Teil       | Wahl                                                         |
|------------|--------------------------------------------------------------|
| Frontend   | Next.js 15 (App Router), React 19, Tailwind, shadcn/ui       |
| Server     | Next.js API-Routen mit Firebase Admin SDK                    |
| Daten      | Firestore `(default)` in `europe-west6` (Zürich)             |
| Dateien    | Firebase Storage (EU, Bucket `beat-heroes-ch.firebasestorage.app`) |
| Auth       | Firebase Auth (Google, E-Mail/Passwort)                      |
| Hosting    | Firebase App Hosting im Projekt `beat-heroes-ch` (EU-Region) |
| Mobile     | zuerst PWA, später Capacitor mit gehosteter App              |

Altes Projekt `studio-7081808686-cc62f` (USA) bleibt nur noch Quelle für die
Migration (`scripts/migrate-from-studio.mjs`) und wird danach abgeschaltet.

## Grundsätze

1. **Der Browser ist nicht vertrauenswürdig.** Alles, was Wert hat (Rolle,
   Schule, Credits, Fortschritt, Freigaben), schreibt nur der Server oder eine
   berechtigte Lehrperson. Die Firestore-Regeln setzen das durch.
2. **Mandantenfähig von Anfang an.** Jede Person gehört zu einer Schule;
   Ranglisten und Sichtbarkeit sind pro Schule.
3. **Öffentlich nur nach Freigabe.** Schüler:innen bearbeiten einen Entwurf,
   eine Lehrperson gibt ihn frei, erst dann ist er öffentlich.
4. **Privat und öffentlich getrennt.** `users/{uid}` ist privat (E-Mail usw.),
   öffentliche Angaben liegen in eigenen Dokumenten ohne Personendaten.

## Rollen

Feld `role` in `users/{uid}`, nur von Server/Super-Admin änderbar.

| Rolle         | Darf                                                         |
|---------------|--------------------------------------------------------------|
| `student`     | lernen, spielen, eigenes Profil entwerfen, Aufgaben abgeben  |
| `teacher`     | Klassen der eigenen Schule führen, Aufgaben zuweisen, Profile freigeben, Credits vergeben |
| `schoolAdmin` | wie teacher + Lehrpersonen und Klassen der Schule verwalten  |
| `superAdmin`  | alles, inkl. Lerninhalte (CMS) und alle Schulen              |

Inhalte mit `minRole` sind für tiefere Rollen gesperrt (z.B. `teacher` für
unfertige Inhalte). Die alten Abo-Rollen `free/pro/producer/admin` wurden bei
der Migration ersetzt: `free` → offen, `pro`/`producer` → `teacher`,
`admin` → `superAdmin`.

Warum Rolle in Firestore statt Custom Claims: in der Console direkt änderbar,
kein Token-Refresh nötig; die Regeln kosten dafür einen Lesezugriff.

## Datenmodell

### Organisation
- `schools/{schoolId}` – öffentliches Schulprofil: `name`, `slug`, `logoUrl`,
  `bannerUrl`, `description`, `website`, `location`, `accentColor`. Öffentlich
  lesbar (Seite `/schools/{id}` mit allen Artists der Schule); pflegen im
  Admin (Super-Admin) bzw. Schul-Admin der Schule. Bilder in Storage
  `schools/{id}/…`.
- `classes/{classId}` – `schoolId`, `name`, `teacherIds[]`, `joinCode`
- `users/{uid}` (privat) – `uid`, `email`, `displayName`, `photoURL`,
  geschützt: `role`, `schoolIds[]`, `schoolId` (= `schoolIds[0]`, Altfeld),
  `classIds[]`, `streetCred`
- **Mehrere Schulen (24.11.2026):** Eine Person kann mehreren Schulen
  angehören (`schoolIds[]`). Klassencode einer anderen Schule ergänzt sie,
  Super-Admins setzen sie im Admin (`POST /api/admin/memberships`). Der Server
  überträgt `schoolIds` auf `standings`, `profiles`, `profileDrafts`,
  `achievements` (`src/lib/server/schools.ts`). Regeln: `isStaffOfAny`/
  `sharesSchool` mit `hasAny`; Abfragen filtern `schoolIds array-contains`.
  Firestore erlaubt nur ein `array-contains` pro Abfrage, darum filtert
  `/teacher` die Klasse im Browser. Regeltest:
  `firebase emulators:exec --only firestore --project demo-beat-heroes "node scripts/test-rules.mjs"`.
  Migration Altdaten: `scripts/migrate-school-ids.mjs`.

### Fortschritt und Credits (nur Server schreibt)
- `users/{uid}/progress/{levelId|learnAppId}` – `accuracy`, `completedAt`
- `users/{uid}/patternProgress/{patternId}`
- `users/{uid}/articleProgress/{articleId}` – `completed`, `quizScore`
- `creditEvents/{id}` – Logbuch: `uid`, `schoolIds`, `amount`, `reason`
  (`level`, `learnApp`, `pattern`, `article`, `assignment`, `teacher`),
  `refId`, `createdAt`, `awardedBy`
- `standings/{uid}` – Ranglisten-Eintrag: `displayName`, `schoolIds`,
  `classIds[]`, `streetCred` (für Schulmitglieder lesbar, ohne E-Mail)

Credits vergibt `POST /api/credits`: prüft das ID-Token, liest `maxPoints`
aus dem Inhalt, zählt nur die Verbesserung gegenüber dem Bestwert und
bewertet Quizzes selbst (der Browser schickt nur die Antworten).

### Profil mit Freigabe (umgesetzt 23.11.2026)
- `profileDrafts/{uid}` – Entwurf, nur Besitzer:in schreibt (Regeln prüfen
  Felder, Längen, Handle-Format, Farbe, `schoolIds` = eigene Schulen);
  Lehrpersonen einer der Schulen lesen und geben frei. `status`: `draft` | `submitted` | `changes_requested` |
  `approved`, `teacherNote` (nur Server).
- `profiles/{uid}` – freigegebene, öffentliche Version; schreibt nur
  `POST /api/profiles/review`. Felder: `artistName`, `handle`, `bio`,
  `avatarUrl`, `bannerUrl`, `accentColor` (#rrggbb aus `ACCENT_COLORS`),
  `featuredUrl` (einer der `embeds`, oben als Player), `roles[]`, `genres[]`,
  `embeds[]` (Spotify/SoundCloud/YouTube), `links[]`, `openForCollab`,
  `schoolIds` (Logos werden live aus `schools` geladen), `approvedBy`,
  `approvedAt`. Weitere Tracks erscheinen als Karten mit Bild + Titel über
  oEmbed (`/api/oembed`, `src/lib/server/oembed.ts`, 1 Tag Cache); Klick
  startet den Player.
- `handles/{handle}` – `uid`; eindeutige Profil-URL `/artists/{handle}`.
- Profilbilder in Storage `profiles/{uid}/…` (öffentlich lesbar, max. 5 MB).
- Seiten: Editor unter `/me`, Freigabe unter `/teacher`, Übersicht
  `/artists` (Suche, Rollen, Genre, Schule, «offen für Kollabos»),
  öffentliche Seite `/artists/[handle]` serverseitig gerendert (OG-Tags).

### Zuweisungen (umgesetzt 23.11.2026)
- `assignments/{id}` – `schoolId`, `classId`, `audience` (`class` | `students`),
  `studentIds[]`, `createdBy`, `refLabel`,
  `title`, `description`, `kind` (`lesson`, `game`, `learnApp`, `task`,
  `beat`), `refId?`, `dueAt?`, `credits`, `createdAt`
- `assignments/{id}/submissions/{uid}` – `status` (`open`, `submitted`,
  `approved`, `changes_requested`), `text?`, `fileUrl?`, `beatId?`,
  `feedback?`, `reviewedBy?`
  Schüler:innen reichen ein (Text/Link), die Lehrperson gibt über
  `POST /api/assignments/review` frei; dabei bucht der Server einmalig die
  Credits der Aufgabe (`creditedAt`). Inhalte (Lektion, Game, Lern-App)
  bringen ihre eigenen Credits zusätzlich über `/api/credits`.
- Klassenbeitritt: `POST /api/classes/join` mit `joinCode` setzt `schoolId`
  und `classIds` serverseitig.

### Beats und Kollabos (Phase 3)
- `beats/{id}` – `ownerId`, `schoolId`, `title`, `audioPath`, `bpm`, `key`,
  `genres[]`, `moods[]`, `status` (`free`, `reserved`, `taken`),
  `visibility` (`school`, `public` – public nur nach Freigabe)
- `collabs/{id}` – Anfrage zwischen Personen zu einem Beat/einer Aufnahme
- `challenges/{id}` – offene Aufrufe („wer baut einen Beat aus dieser Aufnahme?“)

### Lerninhalte (CMS, schreibt nur superAdmin)
`studios`, `games`, `levels/{id}/sounds`, `patterns`, `tracks`, `learnApps`,
`learnCategories`, `learnSubCats`, `articles`, `learnQuizzes`, `learnQuizKeys`,
`courses`, `learningPaths`.

### Kurse (umgesetzt 23.11.2026)
- `courses/{courseId}` – `title`, `subtitle`, `description`, `color`,
  `iconName`, `order`, `chapters[]` (`id`, `title`, `description`, `order`,
  `iconName`, `colorClass`, `appIds[]`). Heute: `producing` (Kapitel = alte
  `learnCategories`-IDs) und `mv` (8 Kapitel, noch ohne Lektionen).
- Lektionen = `articles` mit `courseId` und `chapterId`; Unterthemen weiter
  über `subCategoryId` → `learnSubCats`. Lektionen sind frei wählbar.
- Inhalt einer Lektion (`content`, Absätze durch Leerzeile getrennt):
  `# Titel`, `## Untertitel`, `### Label`, `**fett**`, `[[Begriff]]`
  (hervorgehoben), `---`, `GAP: 20`, `IMAGE: url | Unterschrift | klein`,
  `VIDEO: url`, `YOUTUBE: url | Titel | Text` (Tutorial-Karte),
  `INSPIRATION: url | Titel | Text` (kleine Video-Karte, weiterführend),
  Zeilen mit `- ` (Aufzählung, eingerückt = Unterpunkt), `((optional))`
  (klein, grau), `[Text](https://…)` (Link im Text, neuer Tab),
  `DOWNLOAD: url | Beschriftung` (Link-Knopf),
  `PLUGIN: lektionId | Name | Kurztext` (Verweis-Karte auf eine Lektion im
  Unterthema «Gratis-Plugins» `sc-free` im Kapitel `effects`; als eigener
  Absatz, nicht innerhalb einer `PHASE`),
  `TIP: tipp|merke|achtung|aufgabe | Titel` (+ Textzeilen darunter),
  `PHASE: Titel | Text | lektionId`, `GAME: learnAppId | Beschriftung`
  (Link-Karte zur Übung), `GAME: learnAppId | Beschriftung | pruefung`
  (Prüfung direkt in der Lektion, siehe MV-Übungen), plus `youtubeUrls[]`. Zu einer `PHASE`-Karte
  gehören alle Folgezeilen bis zur nächsten Leerzeile.
- Baustein-Editor (24.11.2026): `src/lib/learn/blocks.ts` wandelt Text ↔
  Bausteine (alle 53 Lektionen ohne Inhaltsverlust geprüft), UI in
  `src/components/admin/BlockEditor.tsx` mit Vorlagen (Standard-Lektion,
  Video-Tutorial, Theorie kurz); Text-Modus bleibt als Umschalter. Quiz in `learnQuizzes/{id}` (Lösungen `learnQuizKeys`).
- Bestanden: `articleProgress.completed` und `quizScore >= 80`, dazu jede
  Prüfung der Lektion mit Bestwert (`users/{uid}/progress/{appId}.accuracy`)
  ab 70 % (`src/lib/learn/tests.ts`, gilt auch für `/api/paths/claim`); Lektionen
  ohne Quiz über «Als gelesen markieren» (Score 100). Setup-Skript:
  `scripts/setup-courses.mjs`.
- Wahlkapitel (24.11.2026): `chapters[].choice = { label }` (heute DAWs,
  «Dein DAW»). Unterthemen sind Alternativen; die Wahl liegt in
  `users/{uid}.choices.{chapterId} = subCatId` (selbst änderbar, Map).
  Gezählt und angezeigt werden nur die Lektionen der Wahl (ohne Wahl: erstes
  Unterthema). `/api/credits` gibt im ganzen Kapitel höchstens so viele
  Credits wie im grössten Unterthema (kein Doppeln beim Wechsel).
- Lektionsseite (24.11.2026, `ArticleView`): Kopf mit Kurs · Kapitel, Titel
  aus der ersten `#`-Zeile, Lesezeit, Quiz-Anzahl, Fortschritt im Kapitel
  (`TopicProgress`), Inhaltsverzeichnis ab 3 `##`, Leseleiste, am Ende
  «Weiter» zur nächsten Lektion. Reihenfolge überall aus
  `useLearnData().orderedLessonsOf/chapterLessons`. Credits werden in
  Lektionen nicht angezeigt, nur Fortschritt (Neu / Am Lernen / Gemeistert).
- Kursseite: «Weitermachen»-Karte (nächste offene Lektion mit Inhalt),
  Kapitel mit Status-Kreis und Fortschrittsbalken.

### MV-Übungen (umgesetzt 23.11.2026)
- Code in `src/lib/mv/` (Synth mit Web Audio, Taktgeber `usePatternPlayer`,
  Pattern-Bibliothek `patterns.ts` mit Stil-Steckbriefen) und
  `src/components/mv/` (RhythmGrid, PianoKeyboard, Übungen, Seite).
- Jede Übung ist ein `learnApps`-Dokument `learn-mv-<id>` mit `type`
  `mv-rhythm` | `mv-keys`, `exerciseId`, `description`, `maxPoints` (150).
  Läuft unter `/session/learn-mv-<id>`, einbettbar mit `GAME:` und als
  Zuweisung (kind `learnApp`); Credits über `/api/credits` (bester Score).
- Rhythmus-Modi (26.11.2026): «1. Anhören» und «2. Mitklopfen» (Timing-
  Auswertung, Einzählen im Pad). Kein Nachbauen mehr. Gewertet wird nur im
  Originaltempo. Lern-Übungen zeigen nur den Klang, um den es geht (Puls =
  nur Viertel, Achtel, Offbeat, Backbeat = Kick + Snare); Grooves der Welt
  bleiben voll instrumentiert.
- Prüfung: `GAME: … | pruefung` bettet die Übung in die Lektion ein
  (`LessonTest`), bestanden ab 70 %. Notennamen zählen nur ohne Hilfe.
  Die MV-Lektionen nennen oben im Kasten «So schliesst du diese Lektion ab»
  Prüfung(en) und Quiz (5 Fragen).
  Klaviatur: Notennamen, Intervalle (Merksongs), Dur/Moll, Tonleiter bauen
  (`tonleiter-dur`/`tonleiter-moll`, `MvScaleExercise`: Grundton gegeben,
  7 Töne nach Bauplan tippen, Fehler werden korrigiert, 4 Tonleitern).
- Neue Patterns: in `PATTERNS` ergänzen und in
  `scripts/setup-mv-exercises.mjs` eintragen (legt App + Kapitel an).

### Lernpfade (z.B. Talentförderung)
- `learningPaths/{id}` – `title`, `description`, `requiredLessonIds[]`,
  `minScore`, `official`, `credits`, `order`, `published`. Pflege im Admin.
- `achievements/{uid}_{pathId}` – nur Server (`POST /api/paths/claim`) prüft
  alle Pflicht-Lektionen und schreibt den Abschluss (offizieller Nachweis);
  Lehrpersonen sehen Abschlüsse in der Klassenansicht.

## Routen (Ziel)

| Route              | Inhalt                                       |
|--------------------|----------------------------------------------|
| `/`                | Dashboard: Credits, Aufgaben, Neues          |
| `/learn`           | Lernen (heute Knowledge Base + Lern-Apps; Ziel: Kurse Producing, MV) |
| `/games`           | alle Games (Typ, Studio, Suche), Levels direkt startbar |
| `/artists`         | Artist-Profile mit Suche/Filter              |
| `/beats`           | Beat-Börse, Challenges                       |
| `/me`              | Profil-Editor + Statistik                    |
| `/artists/[handle]`| öffentliches Profil (serverseitig gerendert) |
| `/schools/[id]`    | öffentliches Schulprofil mit Artists         |
| `/teacher`         | Klassen, Zuweisungen, Freigaben              |
| `/admin`           | CMS                                          |
