// Build-time configuration, read once by the app and handed to the views.
import type { OnlineConfig } from './state/index.ts';

export function onlineConfigFromEnv(env: ImportMetaEnv): OnlineConfig | null {
  if (env.VITE_ONLINE_BACKEND === 'local') return { kind: 'local' };
  const firebase = {
    apiKey: env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    databaseURL: env.VITE_FIREBASE_DATABASE_URL ?? '',
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
    appId: env.VITE_FIREBASE_APP_ID ?? '',
  };
  return Object.values(firebase).every((value) => value.length > 0)
    ? { kind: 'firebase', firebase }
    : null;
}

export const ONLINE_CONFIG = onlineConfigFromEnv(import.meta.env);
