const BASE = 'https://www.googleapis.com/drive/v3';

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

export async function listFolder(folderId: string, apiKey: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `${BASE}/files?q=${q}&fields=files(id,name,mimeType)&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new DriveError(res.status, await res.text());
  const data = await res.json() as { files: DriveFile[] };
  return data.files;
}

export async function fetchFileJson<T>(fileId: string, apiKey: string): Promise<T> {
  const url = `${BASE}/files/${fileId}?alt=media&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new DriveError(res.status, await res.text());
  return res.json() as Promise<T>;
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
