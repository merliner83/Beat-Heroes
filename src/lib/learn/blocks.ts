/**
 * Bausteine einer Lektion. Der Baustein-Editor arbeitet mit Blöcken, gespeichert
 * wird weiterhin der Lektionstext (`content`), den `LessonContent` darstellt.
 * Bestehende Lektionen bleiben damit gültig: parseBlocks(text) → Blöcke →
 * serializeBlocks(blöcke) → gleichwertiger Text.
 *
 * Textformat (Absätze durch Leerzeile getrennt):
 *   # Titel · ## Zwischentitel · ### Label · **fett** · --- · GAP: 20
 *   IMAGE: url | Bildunterschrift
 *   VIDEO: url
 *   YOUTUBE: url | Titel | Beschreibung      (Tutorial-Karte)
 *   GAME: learnAppId | Beschriftung          (Übung)
 *   DOWNLOAD: url | Beschriftung             (Link-Knopf, z.B. Gratis-Plugin)
 *   [[Begriff]] im Text                      (hervorgehobener Fachbegriff)
 *   TIP: art | Titel                         (Box; folgende Zeilen = Text)
 *   PHASE: Titel | Text | lektionId
 */

export type TipKind = 'tipp' | 'merke' | 'achtung' | 'aufgabe';

export type Block =
  | { id: string; type: 'heading'; level: 1 | 2 | 3; text: string }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'gap'; size: number }
  | { id: string; type: 'image'; url: string; caption: string }
  | { id: string; type: 'video'; url: string }
  | { id: string; type: 'youtube'; url: string; title: string; description: string }
  | { id: string; type: 'game'; appId: string; label: string }
  | { id: string; type: 'download'; url: string; label: string }
  | { id: string; type: 'tip'; kind: TipKind; title: string; text: string }
  | { id: string; type: 'phase'; title: string; text: string; lessonId: string };

export type BlockType = Block['type'];

export const TIP_KINDS: { id: TipKind; label: string }[] = [
  { id: 'tipp', label: 'Tipp' },
  { id: 'merke', label: 'Merke' },
  { id: 'achtung', label: 'Achtung' },
  { id: 'aufgabe', label: 'Aufgabe' },
];

let counter = 0;
export const newId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

const parts = (s: string) => s.split('|').map((p) => p.trim());

export function emptyBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case 'heading': return { id, type, level: 2, text: '' };
    case 'text': return { id, type, text: '' };
    case 'divider': return { id, type };
    case 'gap': return { id, type, size: 20 };
    case 'image': return { id, type, url: '', caption: '' };
    case 'video': return { id, type, url: '' };
    case 'youtube': return { id, type, url: '', title: '', description: '' };
    case 'game': return { id, type, appId: '', label: '' };
    case 'download': return { id, type, url: '', label: '' };
    case 'tip': return { id, type, kind: 'tipp', title: '', text: '' };
    case 'phase': return { id, type, title: '', text: '', lessonId: '' };
  }
}

/** Eine einzelne Zeile als Block (Steuerzeile) oder null für Fliesstext. */
function lineBlock(line: string): Block | null {
  const t = line.trim();
  const id = newId();
  if (t === '---') return { id, type: 'divider' };
  if (t.startsWith('GAP:')) return { id, type: 'gap', size: parseInt(t.slice(4).trim()) || 20 };
  if (t.startsWith('IMAGE:')) { const [url, caption = ''] = parts(t.slice(6)); return { id, type: 'image', url, caption }; }
  if (t.startsWith('VIDEO:')) return { id, type: 'video', url: t.slice(6).trim() };
  if (t.startsWith('YOUTUBE:')) { const [url, title = '', description = ''] = parts(t.slice(8)); return { id, type: 'youtube', url, title, description }; }
  if (t.startsWith('DOWNLOAD:')) { const [url, label = ''] = parts(t.slice(9)); return { id, type: 'download', url, label }; }
  if (t.startsWith('GAME:')) { const [appId, label = ''] = parts(t.slice(5)); return { id, type: 'game', appId, label }; }
  if (t.startsWith('###') || t.startsWith('SUB:')) return { id, type: 'heading', level: 3, text: t.replace(/^###\s*|^SUB:\s*/, '') };
  if (t.startsWith('##')) return { id, type: 'heading', level: 2, text: t.replace(/^##\s*/, '') };
  if (t.startsWith('#')) return { id, type: 'heading', level: 1, text: t.replace(/^#\s*/, '') };
  return null;
}

export function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of (content ?? '').split(/\n\s*\n/)) {
    const chunk = raw.replace(/^\n+|\s+$/g, '');
    if (!chunk.trim()) continue;
    const first = chunk.trimStart();
    if (first.startsWith('PHASE:')) {
      const [title, text = '', lessonId = ''] = parts(first.slice(6));
      blocks.push({ id: newId(), type: 'phase', title, text, lessonId });
      continue;
    }
    if (first.startsWith('TIP:')) {
      const [head, ...body] = first.split('\n');
      const [kind, title = ''] = parts(head.slice(4));
      blocks.push({ id: newId(), type: 'tip', kind: (TIP_KINDS.some((k) => k.id === kind) ? kind : 'tipp') as TipKind, title, text: body.join('\n').trim() });
      continue;
    }
    // Gemischte Absätze: Steuerzeilen werden eigene Blöcke, Fliesstext wird zusammengefasst.
    let text: string[] = [];
    const flush = () => {
      if (text.length) blocks.push({ id: newId(), type: 'text', text: text.join('\n') });
      text = [];
    };
    for (const line of chunk.split('\n')) {
      const b = lineBlock(line);
      if (b) { flush(); blocks.push(b); } else text.push(line);
    }
    flush();
  }
  return blocks;
}

const clean = (s: string) => s.replace(/\|/g, '/').replace(/\n+/g, ' ').trim();

export function serializeBlock(b: Block): string {
  switch (b.type) {
    case 'heading': return `${'#'.repeat(b.level)} ${clean(b.text)}`;
    case 'text': return b.text.replace(/\n{2,}/g, '\n').trim();
    case 'divider': return '---';
    case 'gap': return `GAP: ${b.size}`;
    case 'image': return `IMAGE: ${b.url.trim()}${b.caption.trim() ? ` | ${clean(b.caption)}` : ''}`;
    case 'video': return `VIDEO: ${b.url.trim()}`;
    case 'youtube': return `YOUTUBE: ${b.url.trim()}${b.title.trim() || b.description.trim() ? ` | ${clean(b.title)}` : ''}${b.description.trim() ? ` | ${clean(b.description)}` : ''}`;
    case 'download': return `DOWNLOAD: ${b.url.trim()}${b.label.trim() ? ` | ${clean(b.label)}` : ''}`;
    case 'game': return `GAME: ${b.appId} | ${clean(b.label)}`;
    case 'tip': return `TIP: ${b.kind} | ${clean(b.title)}${b.text.trim() ? `\n${b.text.replace(/\n{2,}/g, '\n').trim()}` : ''}`;
    case 'phase': return `PHASE: ${clean(b.title)} | ${b.text.replace(/\|/g, '/').replace(/\n{2,}/g, '\n').trim()}${b.lessonId.trim() ? ` | ${b.lessonId.trim()}` : ''}`;
  }
}

/** Leere Blöcke (z.B. Bild ohne URL) werden weggelassen. */
export function serializeBlocks(blocks: Block[]): string {
  return blocks
    .filter((b) => {
      if (b.type === 'text') return b.text.trim();
      if (b.type === 'heading') return b.text.trim();
      if (b.type === 'image' || b.type === 'video' || b.type === 'youtube' || b.type === 'download') return b.url.trim();
      if (b.type === 'game') return b.appId;
      if (b.type === 'tip') return b.title.trim() || b.text.trim();
      if (b.type === 'phase') return b.title.trim();
      return true;
    })
    .map(serializeBlock)
    .join('\n\n');
}

// --- Vorlagen ---

type Draft = Block extends infer B ? (B extends Block ? Omit<B, 'id'> : never) : never;
const T = (blocks: Draft[]): Block[] => blocks.map((b) => ({ ...b, id: newId() }) as Block);

export const TEMPLATES: { id: string; title: string; description: string; build: () => Block[] }[] = [
  {
    id: 'standard',
    title: 'Standard-Lektion',
    description: 'Einstieg, Erklärung, Merke-Box, Übung, Zusammenfassung',
    build: () => T([
      { type: 'heading', level: 1, text: 'Worum geht es?' },
      { type: 'text', text: 'Ein, zwei Sätze, die neugierig machen. Warum ist das Thema für dich als Musiker:in wichtig?' },
      { type: 'heading', level: 2, text: 'So funktioniert es' },
      { type: 'text', text: 'Erkläre den Kern in kurzen Absätzen. **Wichtige Begriffe fett.**' },
      { type: 'tip', kind: 'merke', title: 'Das Wichtigste', text: 'Ein Satz zum Merken.' },
      { type: 'heading', level: 2, text: 'Probier es aus' },
      { type: 'game', appId: '', label: 'Übung starten' },
      { type: 'divider' },
      { type: 'heading', level: 3, text: 'Zusammenfassung' },
      { type: 'text', text: '• Punkt 1\n• Punkt 2\n• Punkt 3' },
    ]),
  },
  {
    id: 'tutorial',
    title: 'Video-Tutorial',
    description: 'Kurze Einführung, YouTube-Tutorial, Schritte, Aufgabe',
    build: () => T([
      { type: 'heading', level: 1, text: 'Tutorial: …' },
      { type: 'text', text: 'Was lernst du in diesem Video? Was brauchst du dafür (DAW, Plugin, Kopfhörer)?' },
      { type: 'youtube', url: '', title: 'Titel des Tutorials', description: 'Worauf du achten sollst' },
      { type: 'heading', level: 2, text: 'Schritt für Schritt' },
      { type: 'text', text: '1. …\n2. …\n3. …' },
      { type: 'tip', kind: 'tipp', title: 'Profi-Tipp', text: 'Ein Trick, der im Video nicht vorkommt.' },
      { type: 'tip', kind: 'aufgabe', title: 'Deine Aufgabe', text: 'Bau es in deinem eigenen Projekt nach und lade das Ergebnis hoch.' },
    ]),
  },
  {
    id: 'theorie',
    title: 'Theorie kurz',
    description: 'Begriff erklären, Beispiel mit Bild, hören, üben (ideal für MV)',
    build: () => T([
      { type: 'heading', level: 1, text: 'Begriff' },
      { type: 'text', text: 'Definition in einem Satz, so einfach wie möglich.' },
      { type: 'image', url: '', caption: 'Beispiel (Noten, Klaviatur, Raster …)' },
      { type: 'heading', level: 2, text: 'Hör mal' },
      { type: 'text', text: 'In diesem Song hörst du es gut: …' },
      { type: 'game', appId: '', label: 'Jetzt selber üben' },
      { type: 'tip', kind: 'achtung', title: 'Typischer Fehler', text: 'Viele verwechseln … mit …' },
    ]),
  },
];
