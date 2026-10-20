import * as SecureStore from 'expo-secure-store';

import type { AuthProfile, AuthTokens } from '@/lib/auth-api';

const SESSION_KEY = 'seediot.session';

export interface StoredSession {
  profile: AuthProfile;
  tokens: AuthTokens;
}

export async function saveSession(session: StoredSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export function clearSession() {
  return SecureStore.deleteItemAsync(SESSION_KEY);
}
