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

// Accepts a full Drive folder URL or a bare folder ID
export function parseFolderId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export const FOLDER_ID_KEY = 'coach-drive-folder-id';

// Shared secret that gates writes through the /publish proxy — the same code
// for every coach, so nobody needs to sign in to Drive as anyone else.
export const CLUB_CODE_KEY = 'coach-club-code';

export function getClubCode(): string {
  return localStorage.getItem(CLUB_CODE_KEY) ?? '';
}

export function setClubCode(code: string): void {
  const trimmed = code.trim();
  if (trimmed) localStorage.setItem(CLUB_CODE_KEY, trimmed);
  else localStorage.removeItem(CLUB_CODE_KEY);
}

export function clubCodeConfigured(): boolean {
  return getClubCode().length > 0;
}
