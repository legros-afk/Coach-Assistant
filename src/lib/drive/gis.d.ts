interface GisTokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken(overrideConfig?: { prompt?: string }): void;
  callback: (response: GisTokenResponse) => void;
}

interface GisTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GisTokenResponse) => void;
}

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient(config: GisTokenClientConfig): GisTokenClient;
        revoke(token: string, callback: () => void): void;
      };
    };
  };
}
