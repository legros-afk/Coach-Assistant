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
// Checked against the CLUB_PUBLISH_CODE secret set server-side; never
// stored or embedded in the app's source.
export const CLUB_PIN_KEY = 'coach-club-pin';

export function getClubPin(): string {
  return localStorage.getItem(CLUB_PIN_KEY) ?? '';
}

export function setClubPin(pin: string): void {
  const trimmed = pin.trim();
  if (trimmed) localStorage.setItem(CLUB_PIN_KEY, trimmed);
  else localStorage.removeItem(CLUB_PIN_KEY);
}

export function clubPinConfigured(): boolean {
  return getClubPin().length > 0;
}
