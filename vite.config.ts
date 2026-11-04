import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
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

/**
 * Generate sw.js with every file of this build in its precache list, so the whole app
 * (including the engine) works offline once installed. See src/sw-template.js.
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const publicDir = join(import.meta.dirname, 'public');
      const publicFiles = readdirSync(publicDir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name !== '_headers')
        .map((entry) =>
          join(entry.parentPath, entry.name)
            .slice(publicDir.length + 1)
            .split('\\')
            .join('/'),
        );
      const files = ['./', ...Object.keys(bundle), ...publicFiles]
        .filter((file) => file !== 'sw.js' && !file.endsWith('.map'))
        .sort();
      const version = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12);
      const template = readFileSync(join(import.meta.dirname, 'src', 'sw-template.js'), 'utf8');
      const source = template
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// Relative base so the build works on Cloudflare Pages, preview URLs and sub-paths.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), stockfishEngine(), serviceWorker()],
  build: {
    target: 'es2022',
  },
});
