// Dependency rules between the layers in src/. Kept as data so CLAUDE.md,
// docs/architecture.md and this checker describe the same thing.
import { posix } from 'node:path';

export const LAYERS = [
  'core',
  'ai',
  'online',
  'state',
  'i18n',
  'board',
  'components',
  'views',
  'app',
] as const;
export type Layer = (typeof LAYERS)[number];

/** The public API of the rules core; other layers import core only from here. */
export const CORE_ENTRY = 'src/core/index.ts';

const UI_LAYERS: readonly Layer[] = ['board', 'components', 'views', 'app'];

/** Which other src layers each layer may import. Imports within a layer are always allowed. */
export const ALLOWED_LAYER_IMPORTS: Record<Layer, readonly Layer[]> = {
  core: [],
  ai: ['core'],
  online: ['core'],
  state: ['core', 'ai', 'online'],
  i18n: [],
  board: ['core', 'i18n', 'components'],
  components: ['core', 'state', 'i18n', 'board'],
  views: ['core', 'state', 'i18n', 'board', 'components'],
  app: ['core', 'state', 'i18n', 'board', 'components', 'views'],
};

interface PackageRule {
  /** Package name; subpath imports (`name/...`) are covered too. */
  name: string;
  /** Returns true when `file` (a path relative to the repo root) may import the package. */
  allowed: (file: string, layer: Layer) => boolean;
  reason: string;
}

export const PACKAGE_RULES: readonly PackageRule[] = [
  {
    name: 'chess.js',
    allowed: (_file, layer) => layer === 'core',
    reason: 'only src/core may use chess.js; other layers use the core API',
  },
  {
    name: 'stockfish',
    allowed: (_file, layer) => layer === 'ai',
    reason: 'only src/ai may load Stockfish',
  },
  {
    name: 'firebase',
    allowed: (file) => file.startsWith('src/online/firebase/'),
    reason: 'only src/online/firebase/ may use Firebase; the rest goes through RoomBackend',
  },
  ...['react', 'react-dom'].map((name): PackageRule => ({
    name,
    allowed: (_file, layer) => UI_LAYERS.includes(layer) || layer === 'i18n',
    reason: 'core, ai, online and state must not depend on React',
  })),
];

export interface SourceFile {
  /** Path relative to the repo root, with forward slashes, e.g. `src/core/game.ts`. */
  path: string;
  source: string;
}

export interface Violation {
  file: string;
  specifier: string;
  reason: string;
}

export function layerOf(path: string): Layer | null {
  const parts = path.split('/');
  if (parts[0] !== 'src' || parts.length < 2) return null;
  if (parts.length === 2) return 'app';
  const dir = parts[1];
  return dir !== 'app' && (LAYERS as readonly string[]).includes(dir ?? '') ? (dir as Layer) : null;
}

const IMPORT_PATTERNS = [
  // import x from 'y'; import { x } from 'y'; export { x } from 'y'; import type ... from 'y'
  /\b(?:import|export)\s[^'"]*?\sfrom\s*['"]([^'"]+)['"]/g,
  // import 'y';
  /\bimport\s*['"]([^'"]+)['"]/g,
  // import('y'); new URL('y', import.meta.url) is not an import and is ignored.
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/** Every module specifier imported or re-exported by a source file. */
export function importsOf(source: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const found = new Set<string>();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of withoutComments.matchAll(pattern)) {
      if (match[1] !== undefined) found.add(match[1]);
    }
  }
  return [...found];
}

function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

export function findViolations(files: readonly SourceFile[]): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    const layer = layerOf(file.path);
    if (!layer) {
      violations.push({
        file: file.path,
        specifier: '',
        reason: 'file is outside the known layers',
      });
      continue;
    }
    for (const raw of importsOf(file.source)) {
      const specifier = raw.replace(/\?.*$/, '');
      if (specifier.startsWith('.')) {
        const target = posix.normalize(posix.join(posix.dirname(file.path), specifier));
        const targetLayer = layerOf(target);
        if (!targetLayer) {
          if (!target.startsWith('src/')) {
            violations.push({
              file: file.path,
              specifier: raw,
              reason: 'imports from outside src/',
            });
          }
          continue;
        }
        if (targetLayer !== layer && !ALLOWED_LAYER_IMPORTS[layer].includes(targetLayer)) {
          violations.push({
            file: file.path,
            specifier: raw,
            reason: `${layer} may not import ${targetLayer}`,
          });
        } else if (targetLayer === 'core' && layer !== 'core' && target !== CORE_ENTRY) {
          violations.push({
            file: file.path,
            specifier: raw,
            reason: `other layers use the core API through ${CORE_ENTRY}`,
          });
        }
        continue;
      }
      const name = packageName(specifier);
      for (const rule of PACKAGE_RULES) {
        if (rule.name === name && !rule.allowed(file.path, layer)) {
          violations.push({ file: file.path, specifier: raw, reason: rule.reason });
        }
      }
    }
  }
  return violations;
}
