# Beat-Heroes

Web-App (Next.js 15 + Firebase), später auch als iOS- und Android-App.

## Lokal entwickeln

```bash
npm install
npm run dev        # http://localhost:9002
npm run typecheck
```

## Firebase

Genutzt werden Authentication, Cloud Firestore und Cloud Storage
(Projekt `studio-7081808686-cc62f`). Die Web-Konfiguration steht in
`src/firebase/config.ts`.

Firestore-Regeln deployen:

```bash
firebase deploy --only firestore:rules
```

## Umgebungsvariablen

- `GEMINI_API_KEY` – nur für die Genkit-Flows in `src/ai/` (aktuell ungenutzt)
- `AUDIO_PROXY_ALLOWED_HOSTS` – optionale zusätzliche Hosts für `/api/proxy-audio`, kommagetrennt
