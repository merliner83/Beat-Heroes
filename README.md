# Beat-Heroes

Web-App (Next.js 15 + Firebase), später auch als iOS- und Android-App.

## Lokal entwickeln

```bash
npm install
npm run dev        # http://localhost:9002
npm run typecheck
```

## Firebase

Projekt `beat-heroes-ch` (Firestore in `europe-west6`, Zürich). Genutzt werden
Authentication, Cloud Firestore und Cloud Storage. Die Web-Konfiguration steht
in `src/firebase/config.ts`, das Datenmodell in `docs/architecture.md`.

API-Routen nutzen das Admin SDK. Lokal braucht es dafür einmal:

```bash
gcloud auth application-default login
```

Regeln und Indizes deployen:

```bash
firebase deploy --only firestore,storage
```

Rolle setzen (Person muss sich einmal angemeldet haben):

```bash
node scripts/set-role.mjs person@example.com superAdmin
```

Inhalte aus dem alten Projekt `studio-7081808686-cc62f` übernehmen:
`scripts/migrate-from-studio.mjs` (ohne `--write` nur Probelauf).

## Umgebungsvariablen

- `GEMINI_API_KEY` – nur für die Genkit-Flows in `src/ai/` (aktuell ungenutzt)
- `AUDIO_PROXY_ALLOWED_HOSTS` – optionale zusätzliche Hosts für `/api/proxy-audio`, kommagetrennt
