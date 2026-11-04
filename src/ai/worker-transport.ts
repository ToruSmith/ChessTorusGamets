// Runs the engine in a Web Worker: the Stockfish.js file is itself the worker script.
import type { UciTransport } from './engine.ts';

export function workerTransport(scriptUrl: string): UciTransport {
  const worker = new Worker(scriptUrl);
  let handler: (line: string) => void = () => undefined;
  worker.onmessage = (event: MessageEvent) => {
    if (typeof event.data === 'string') {
      for (const line of event.data.split('\n')) if (line) handler(line);
    }
  };
  return {
    send: (line) => worker.postMessage(line),
    onLine: (next) => {
      handler = next;
    },
    terminate: () => worker.terminate(),
  };
}
