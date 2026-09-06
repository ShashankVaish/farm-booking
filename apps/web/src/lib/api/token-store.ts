/**
 * Access-token strategy. Pages talk to the API client; this store can later
 * move to httpOnly cookies without changing fetch call sites.
 */
let accessToken: string | null = null;
const STORAGE_KEY = 'farmhouse.accessToken';

export type TokenStore = {
  getAccessToken: () => string | null | Promise<string | null>;
  setAccessToken?: (token: string | null) => void;
};

export const memoryTokenStore: Required<TokenStore> = {
  getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(STORAGE_KEY);
    }
    return accessToken;
  },
  setAccessToken(token: string | null): void {
    accessToken = token;
    if (typeof window === 'undefined') {
      return;
    }
    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },
};
