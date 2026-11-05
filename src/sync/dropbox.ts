// Minimal Dropbox client for a browser-only app: OAuth 2 with PKCE (no secret,
// no server), and one file in the app's own folder (Apps/TodoFlow/).

export const SYNC_PATH = '/todoflow.json';

const AUTHORIZE = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN = 'https://api.dropboxapi.com/oauth2/token';
const API = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** ms since epoch. */
  expiresAt: number;
  accountId?: string;
}

export class ConflictError extends Error {
  constructor() {
    super('The file in Dropbox changed since it was last read.');
  }
}

export class AuthError extends Error {
  constructor(msg = 'Dropbox sign-in expired. Connect again.') {
    super(msg);
  }
}

export interface RemoteFile {
  text: string;
  rev: string;
}

/** What the sync engine needs from a store. A fake implements it in tests. */
export interface RemoteStore {
  download(): Promise<RemoteFile | null>;
  /** `rev` null = create; otherwise update only if the file is still at `rev`. */
  upload(text: string, rev: string | null): Promise<string>;
}

type Fetch = typeof fetch;

// ---------- PKCE ----------
function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomString(len = 64): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return b64url(bytes).slice(0, len);
}

export async function challengeFor(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(hash));
}

export async function authorizeUrl(appKey: string, redirectUri: string, verifier: string, state: string): Promise<string> {
  const q = new URLSearchParams({
    client_id: appKey,
    response_type: 'code',
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
    token_access_type: 'offline',
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTHORIZE}?${q}`;
}

async function tokenRequest(body: Record<string, string>, f: Fetch): Promise<Tokens & { refreshToken: string }> {
  const res = await f(TOKEN, { method: 'POST', body: new URLSearchParams(body) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new AuthError(String(json.error_description ?? 'Dropbox refused the sign-in.'));
  return {
    accessToken: String(json.access_token),
    refreshToken: String(json.refresh_token ?? body.refresh_token ?? ''),
    expiresAt: Date.now() + (Number(json.expires_in ?? 14400) - 60) * 1000,
    accountId: json.account_id ? String(json.account_id) : undefined,
  };
}

export function exchangeCode(appKey: string, code: string, verifier: string, redirectUri: string, f: Fetch = fetch): Promise<Tokens> {
  return tokenRequest({ code, grant_type: 'authorization_code', client_id: appKey, code_verifier: verifier, redirect_uri: redirectUri }, f);
}

// ---------- Client ----------
export class DropboxStore implements RemoteStore {
  constructor(
    private appKey: string,
    private tokens: Tokens,
    private onTokens: (t: Tokens) => void,
    private f: Fetch = (...a) => fetch(...a),
  ) {}

  private async token(): Promise<string> {
    if (Date.now() < this.tokens.expiresAt) return this.tokens.accessToken;
    if (!this.tokens.refreshToken) throw new AuthError();
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: this.tokens.refreshToken, client_id: this.appKey }, this.f);
    this.tokens = { ...this.tokens, ...t, refreshToken: this.tokens.refreshToken };
    this.onTokens(this.tokens);
    return this.tokens.accessToken;
  }

  private async call(url: string, init: RequestInit, retried = false): Promise<Response> {
    const res = await this.f(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await this.token()}` } });
    if (res.status === 401 && !retried) {
      this.tokens = { ...this.tokens, expiresAt: 0 };
      return this.call(url, init, true);
    }
    if (res.status === 401) throw new AuthError();
    return res;
  }

  async download(): Promise<RemoteFile | null> {
    const res = await this.call(`${CONTENT}/files/download`, {
      method: 'POST',
      headers: { 'Dropbox-API-Arg': JSON.stringify({ path: SYNC_PATH }) },
    });
    if (res.status === 409) {
      const err = await res.text();
      if (err.includes('not_found')) return null;
      throw new Error(`Dropbox download failed: ${err.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(`Dropbox download failed (${res.status})`);
    const meta = JSON.parse(res.headers.get('Dropbox-API-Result') ?? '{}') as { rev?: string };
    return { text: await res.text(), rev: meta.rev ?? '' };
  }

  async upload(text: string, rev: string | null): Promise<string> {
    const arg = { path: SYNC_PATH, mode: rev ? { '.tag': 'update', update: rev } : 'add', autorename: false, mute: true };
    const res = await this.call(`${CONTENT}/files/upload`, {
      method: 'POST',
      headers: { 'Dropbox-API-Arg': JSON.stringify(arg), 'Content-Type': 'application/octet-stream' },
      body: text,
    });
    if (res.status === 409) {
      const err = await res.text();
      if (err.includes('conflict')) throw new ConflictError();
      throw new Error(`Dropbox upload failed: ${err.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(`Dropbox upload failed (${res.status})`);
    return ((await res.json()) as { rev: string }).rev;
  }

  async accountName(): Promise<string | undefined> {
    const res = await this.call(`${API}/users/get_current_account`, { method: 'POST' });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { name?: { display_name?: string }; email?: string };
    return j.name?.display_name ?? j.email;
  }

  async revoke(): Promise<void> {
    await this.call(`${API}/auth/token/revoke`, { method: 'POST' }).catch(() => undefined);
  }
}
