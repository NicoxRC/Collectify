/**
 * Token storage strategy (Phase 2 decision — see docs/phasesClient/PHASE_2_AUTH.md):
 *
 * - Access token: kept in memory only (a module-level variable). Never
 *   touches localStorage, so it can't be read by a stray XSS payload that
 *   scans storage after the fact. Lost on a hard refresh — that's expected.
 * - Refresh token: persisted in localStorage so a page refresh doesn't force
 *   a re-login. On app bootstrap (see features/auth/AuthContext.tsx), the
 *   stored refresh token is exchanged for a fresh access token before any
 *   protected route renders.
 *
 * Lives in lib/ (not features/auth/) because lib/apiClient.ts depends on it
 * too, and lib/ must not depend on features/ — see docs/ARCHITECTURE.md.
 */

const REFRESH_TOKEN_STORAGE_KEY = 'collectify.refreshToken';

let accessToken: string | null = null;

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },
  setAccessToken(token: string | null): void {
    accessToken = token;
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  },
  setRefreshToken(token: string | null): void {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    }
  },
  clear(): void {
    accessToken = null;
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  },
};
