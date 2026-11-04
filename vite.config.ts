import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Stockfish.js lite single-threaded: the .js file is the Web Worker and loads the .wasm next to it. */
const ENGINE_FILES = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm'];
const ENGINE_DIR = join(import.meta.dirname, 'node_modules', 'stockfish', 'bin');

const ENGINE_SOURCE_NOTE = `Stockfish.js 19.0.1 (lite, single-threaded), unmodified, GPL-3.0.
Corresponding Source: https://github.com/nmrugg/stockfish.js/tree/v19.0.1
Stockfish: https://github.com/official-stockfish/Stockfish
License text: https://github.com/nmrugg/stockfish.js/blob/v19.0.1/Copying.txt
This site's own source (GPL-3.0): https://github.com/ToruSmith/ChessTorusGamets
`;

/** Serve the engine at /engine/ in development and copy it to dist/engine/ in builds. */
function stockfishEngine(): Plugin {
  return {
    name: 'stockfish-engine',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0]?.replace(/^.*\/engine\//, '');
        if (!req.url?.includes('/engine/') || !name || !ENGINE_FILES.includes(name)) return next();
        res.setHeader(
          'Content-Type',
          name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
        );
        res.end(readFileSync(join(ENGINE_DIR, name)));
      });
    },
    generateBundle() {
      // GPL-3.0 §6: say where the Corresponding Source of the shipped engine is.
      this.emitFile({ type: 'asset', fileName: 'engine/SOURCE.txt', source: ENGINE_SOURCE_NOTE });
      for (const name of ENGINE_FILES) {
        this.emitFile({
          type: 'asset',
          fileName: `engine/${name}`,
          source: readFileSync(join(ENGINE_DIR, name)),
        });
      }
    },
  };
}

// Relative base so the build works on Cloudflare Pages, preview URLs and sub-paths.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), stockfishEngine()],
  build: {
    target: 'es2022',
  },
});
