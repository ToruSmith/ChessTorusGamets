// One shared engine per page, created on first use.
import { UciEngine, workerTransport, type UciTransport } from '../ai/index.ts';

export type EngineFactory = () => UciTransport;

/** An engine factory that runs Stockfish.js from `scriptUrl` in a Web Worker. */
export function workerEngine(scriptUrl: string): EngineFactory {
  return () => workerTransport(scriptUrl);
}

let shared: { factory: EngineFactory; engine: UciEngine } | null = null;

export function getEngine(factory: EngineFactory): UciEngine {
  if (!shared || shared.factory !== factory) {
    shared?.engine.dispose();
    shared = { factory, engine: new UciEngine(factory()) };
  }
  return shared.engine;
}
