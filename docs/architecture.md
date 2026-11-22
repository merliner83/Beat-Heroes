# Beat-Heroes – Architektur

Stand: 22.11.2026. Lebendes Dokument; bei Änderungen am Datenmodell nachführen.

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
- `schools/{schoolId}` – `name`, `slug`
- `classes/{classId}` – `schoolId`, `name`, `teacherIds[]`, `joinCode`
- `users/{uid}` (privat) – `uid`, `email`, `displayName`, `photoURL`,
  geschützt: `role`, `schoolId`, `classIds[]`, `streetCred`

### Fortschritt und Credits (nur Server schreibt)
- `users/{uid}/progress/{levelId|learnAppId}` – `accuracy`, `completedAt`
- `users/{uid}/patternProgress/{patternId}`
- `users/{uid}/articleProgress/{articleId}` – `completed`, `quizScore`
- `creditEvents/{id}` – Logbuch: `uid`, `schoolId`, `amount`, `reason`
  (`level`, `learnApp`, `pattern`, `article`, `assignment`, `teacher`),
  `refId`, `createdAt`, `awardedBy`
- `standings/{uid}` – Ranglisten-Eintrag: `displayName`, `schoolId`,
  `classIds[]`, `streetCred` (für Schulmitglieder lesbar, ohne E-Mail)

Credits vergibt `POST /api/credits`: prüft das ID-Token, liest `maxPoints`
aus dem Inhalt, zählt nur die Verbesserung gegenüber dem Bestwert und
bewertet Quizzes selbst (der Browser schickt nur die Antworten).

### Profil mit Freigabe (Phase 2)
- `profileDrafts/{uid}` – Entwurf, nur Besitzer:in schreibt; Lehrperson liest.
  `status`: `draft` | `submitted` | `changes_requested`, `teacherNote`
- `profiles/{uid}` – freigegebene, öffentliche Version; schreibt nur
  Lehrperson/Server bei Freigabe. `handle`, `bio`, `avatarUrl`, `links[]`,
  `embeds[]` (Spotify/SoundCloud/YouTube-URLs), `featuredBeatIds[]`,
  `approvedBy`, `approvedAt`
- `handles/{handle}` – `uid`, sorgt für eindeutige Profil-URLs `/@handle`

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
`learnCategories`, `learnSubCats`, `articles`, `learnQuizzes`.
Geplanter Umbau (Phase 1): Kurse → Lektionen → Blöcke (Text, Video, Quiz,
Minigame), damit „Producing“ und „MV“ dieselbe Struktur nutzen.

## Routen (Ziel)

| Route              | Inhalt                                       |
|--------------------|----------------------------------------------|
| `/`                | Dashboard: Credits, Aufgaben, Neues          |
| `/learn`           | Lernen (heute Knowledge Base + Lern-Apps; Ziel: Kurse Producing, MV) |
| `/games`           | Arcade                                       |
| `/beats`           | Beat-Börse, Challenges                       |
| `/me/edit`         | Profil-Entwurf bearbeiten                    |
| `/@[handle]`       | öffentliches Profil (serverseitig gerendert) |
| `/teacher`         | Klassen, Zuweisungen, Freigaben              |
| `/admin`           | CMS                                          |
