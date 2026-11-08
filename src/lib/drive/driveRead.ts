export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export class DriveError extends Error {
  constructor(public readonly status: number, body: string) {
    super(body);
    this.name = 'DriveError';
  }
}

async function driveGet<T>(path: string): Promise<T> {
  const res = await fetch(`/drive?path=${encodeURIComponent(path)}`)
  if (!res.ok) {
    const body = await res.text()
    throw new DriveError(res.status, body)
  }
  return res.json() as Promise<T>
}

export async function listFolder(folderId: string, _apiKey?: string): Promise<DriveFile[]> {
  const q    = `'${folderId}' in parents and trashed = false`
  const data = await driveGet<{ files: DriveFile[] }>(
    `files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)`
  )
  return data.files
}

export async function fetchFileJson<T>(fileId: string, _apiKey?: string): Promise<T> {
  return driveGet<T>(`files/${fileId}?alt=media`)
}

// Shared PIN that gates writes through the /publish proxy — the same PIN
// for every coach, so nobody needs to sign in to Drive as anyone else.
// Checked against the CLUB_PUBLISH_CODE (or SAFEGUARDING_PIN) secret set
// server-side; never stored or embedded in the app's source.
export const CLUB_PIN_KEY = 'coach-club-pin';

export function getClubPin(): string {
  return localStorage.getItem(CLUB_PIN_KEY) ?? '';
}

export function setClubPin(pin: string, role?: PinRole): void {
  const trimmed = pin.trim();
  if (trimmed) localStorage.setItem(CLUB_PIN_KEY, trimmed);
  else localStorage.removeItem(CLUB_PIN_KEY);
  // A new PIN forgets the old PIN's role until the server says otherwise
  if (trimmed && role) localStorage.setItem(CLUB_ROLE_KEY, role);
  else localStorage.removeItem(CLUB_ROLE_KEY);
}

// The PIN also says who you are: the coaches' PIN (CLUB_PUBLISH_CODE) or the
// safeguarding officer's (SAFEGUARDING_PIN). The server decides; the app
// keeps the answer next to the PIN. No stored role means coach — that's what
// every PIN meant before the safeguarding role existed.
export type PinRole = 'coach' | 'safeguarding';
export const CLUB_ROLE_KEY = 'coach-club-role';

export function getClubRole(): PinRole | null {
  if (!clubPinConfigured()) return null;
  return localStorage.getItem(CLUB_ROLE_KEY) === 'safeguarding' ? 'safeguarding' : 'coach';
}

export function setClubRole(role: PinRole): void {
  if (clubPinConfigured()) localStorage.setItem(CLUB_ROLE_KEY, role);
}

export function isSafeguardingRole(): boolean {
  return getClubRole() === 'safeguarding';
}

/** A coach PIN is set: may pick teams and share squad/fixtures/matches. */
export function coachPinConfigured(): boolean {
  return getClubRole() === 'coach';
}

export type PinCheck =
  | { ok: true; role: PinRole }
  | { ok: false; wrong: boolean; error: string };

/** Ask the server which role a PIN unlocks. Writes nothing. */
export async function checkClubPin(pin: string): Promise<PinCheck> {
  try {
    const res = await fetch('/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: pin.trim(), check: true }),
    });
    const data = await res.json().catch(() => ({})) as { ok?: boolean; role?: string; error?: string };
    if (res.ok && data.ok === true && (data.role === 'coach' || data.role === 'safeguarding')) {
      return { ok: true, role: data.role };
    }
    return { ok: false, wrong: res.status === 403, error: data.error ?? `PIN check failed (${res.status})` };
  } catch (e) {
    return { ok: false, wrong: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export function clubPinConfigured(): boolean {
  return getClubPin().length > 0;
}
