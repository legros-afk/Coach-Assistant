const BASE        = 'https://www.googleapis.com/drive/v3';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const BOUNDARY    = '==coach_boundary==';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export class DriveWriteError extends Error {
  constructor(public readonly status: number, body: string) {
    super(`Drive write error ${status}: ${body}`);
    this.name = 'DriveWriteError';
  }
}

function multipartBody(metadata: object, content: unknown): string {
  return [
    `--${BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(content),
    `--${BOUNDARY}--`,
  ].join('\r\n');
}

async function driveRequest(
  url: string,
  method: string,
  token: string,
  body?: string,
  contentType?: string,
): Promise<unknown> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (contentType) headers['Content-Type'] = contentType;
  const res = await fetch(url, { method, headers, body });
  if (!res.ok) throw new DriveWriteError(res.status, await res.text());
  return res.json();
}

async function createFile(
  name: string,
  content: unknown,
  folderId: string,
  token: string,
): Promise<string> {
  const data = await driveRequest(
    `${UPLOAD_BASE}/files?uploadType=multipart`,
    'POST',
    token,
    multipartBody({ name, parents: [folderId] }, content),
    `multipart/related; boundary=${BOUNDARY}`,
  ) as { id: string };
  return data.id;
}

async function patchFile(
  fileId: string,
  name: string,
  content: unknown,
  token: string,
): Promise<string> {
  const data = await driveRequest(
    `${UPLOAD_BASE}/files/${fileId}?uploadType=multipart`,
    'PATCH',
    token,
    multipartBody({ name }, content),
    `multipart/related; boundary=${BOUNDARY}`,
  ) as { id: string };
  return data.id;
}

export async function upsertJsonFile(
  name: string,
  content: unknown,
  folderId: string,
  token: string,
  existingFileId?: string | null,
): Promise<string> {
  if (existingFileId) {
    try {
      return await patchFile(existingFileId, name, content, token);
    } catch (e) {
      if (!(e instanceof DriveWriteError && e.status === 404)) throw e;
      // File was deleted — fall through to create
    }
  }
  return createFile(name, content, folderId, token);
}

export async function ensureSubfolder(
  name: string,
  parentId: string,
  token: string,
): Promise<string> {
  // Try to list the folder using drive.file scope — only finds folders the app created
  const q = encodeURIComponent(
    `'${parentId}' in parents and name = '${name}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
  );
  const res = await fetch(`${BASE}/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const data = await res.json() as { files: Array<{ id: string }> };
    if (data.files.length > 0) return data.files[0].id;
  }
  // Create it
  const created = await driveRequest(
    `${BASE}/files`,
    'POST',
    token,
    JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    'application/json',
  ) as { id: string };
  return created.id;
}
