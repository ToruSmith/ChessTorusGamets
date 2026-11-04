// The real Stockfish.js lite single-threaded engine, run in Node for tests.
import { createRequire } from 'node:module';
import type { UciTransport } from '../../src/ai/index.ts';

const require = createRequire(import.meta.url);

interface NodeStockfish {
  processCommand(line: string): void;
  terminate(): void;
}

export function nodeStockfish(): UciTransport {
  let handler: (line: string) => void = () => undefined;
  const engine = (
    require('stockfish') as (kind: string, onLine: (line: string) => void) => NodeStockfish
  )('lite-single', (line) => handler(line));
  return {
    send: (line) => engine.processCommand(line),
    onLine: (next) => {
      handler = next;
    },
    terminate: () => engine.terminate(),
  };
}
