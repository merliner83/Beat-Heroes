import type { User } from 'firebase/auth';

/** POST an eine eigene API-Route mit dem ID-Token der angemeldeten Person. */
export async function apiPost<T>(user: User, path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const token = await user.getIdToken();
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error ?? `Fehler ${res.status}` };
    return { ok: true, data: json as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Netzwerkfehler' };
  }
}
