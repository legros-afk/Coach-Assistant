const SCOPE = 'https://www.googleapis.com/auth/drive.file';

let _tokenClient: GisTokenClient | null = null;
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

function getTokenClient(): GisTokenClient {
  if (_tokenClient) return _tokenClient;
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error('VITE_GOOGLE_OAUTH_CLIENT_ID is not set');
  if (!window.google?.accounts?.oauth2) throw new Error('Google Identity Services not loaded');
  _tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: () => {},
  });
  return _tokenClient;
}

export async function requestDriveToken(): Promise<string> {
  await loadGis();
  const client = getTokenClient();

  if (_cachedToken && Date.now() < _tokenExpiresAt) return _cachedToken;

  return new Promise((resolve, reject) => {
    client.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error_description ?? resp.error)); return; }
      _cachedToken = resp.access_token;
      _tokenExpiresAt = Date.now() + resp.expires_in * 1000 - 60_000;
      resolve(resp.access_token);
    };
    client.requestAccessToken({ prompt: _cachedToken ? '' : 'consent' });
  });
}

export function revokeDriveToken(): void {
  if (_cachedToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(_cachedToken, () => {});
    _cachedToken = null;
    _tokenExpiresAt = 0;
  }
}

export function isDriveSignedIn(): boolean {
  return _cachedToken !== null && Date.now() < _tokenExpiresAt;
}

export const OAUTH_ENABLED = !!(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID);
