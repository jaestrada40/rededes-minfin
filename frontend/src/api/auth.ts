import { apiPost, apiFetch, setAccessToken, setRefreshToken, getRefreshToken } from './client';

export interface LoginResult {
  requiresMfaSetup?: true;
  requiresMfaCode?: true;
  setupToken?: string;
  challengeToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface MfaSetupResult {
  qrDataUrl: string;
  verifyToken: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function login(email: string, password: string): Promise<LoginResult> {
  return apiPost<LoginResult>('/auth/login', { email, password });
}

export function mfaSetup(setupToken: string): Promise<MfaSetupResult> {
  return apiPost<MfaSetupResult>('/auth/mfa/setup', { setupToken });
}

export function mfaSetupVerify(token: string, code: string): Promise<TokenPair> {
  return apiPost<TokenPair>('/auth/mfa/setup/verify', { token, code });
}

export function mfaVerify(token: string, code: string): Promise<TokenPair> {
  return apiPost<TokenPair>('/auth/mfa/verify', { token, code });
}

// Deduplicado a nivel de módulo: en desarrollo, React.StrictMode monta el
// árbol dos veces, invocando este efecto dos veces. Sin este guard, la
// segunda llamada reutilizaría un refresh token que la primera ya rotó,
// disparando la detección de reutilización del backend y revocando toda la
// sesión recién creada.
let restoreSessionPromise: Promise<TokenPair | null> | null = null;

export function restoreSession(): Promise<TokenPair | null> {
  if (restoreSessionPromise) return restoreSessionPromise;

  restoreSessionPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const tokens = await apiFetch<TokenPair>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }, false);
      applyTokens(tokens);
      return tokens;
    } catch {
      setAccessToken(null);
      setRefreshToken(null);
      return null;
    } finally {
      restoreSessionPromise = null;
    }
  })();

  return restoreSessionPromise;
}

export function applyTokens(tokens: TokenPair): void {
  setAccessToken(tokens.accessToken);
  setRefreshToken(tokens.refreshToken);
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  setAccessToken(null);
  setRefreshToken(null);
  if (refreshToken) {
    try {
      await apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }, false);
    } catch {
      // best-effort revoke; local session is already cleared
    }
  }
}

export interface JwtClaims {
  sub: string;
  email: string;
  role: string;
}

export function decodeAccessToken(token: string): JwtClaims {
  const payload = token.split('.')[1];
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}
