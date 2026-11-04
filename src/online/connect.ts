import type { OnlineConfig, RoomBackend } from './types.ts';

/** Sign in and connect. The Firebase SDK is downloaded only here, on first use. */
export async function connectBackend(config: OnlineConfig): Promise<RoomBackend> {
  if (config.kind === 'local') {
    const { connectLocal } = await import('./local-backend.ts');
    return connectLocal();
  }
  const { connectFirebase } = await import('./firebase/backend.ts');
  return connectFirebase(config.firebase);
}
