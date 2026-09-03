/**
 * Placeholder access-token strategy.
 * Later phases can swap this for httpOnly-cookie session handling
 * without changing page-level fetch calls.
 */
let accessToken: string | null = null;

export const memoryTokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },
  setAccessToken(token: string | null): void {
    accessToken = token;
  },
};

export type TokenStore = {
  getAccessToken: () => string | null | Promise<string | null>;
};
