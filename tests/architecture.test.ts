import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, it } from 'node:test';
import { findViolations, importsOf, layerOf, type SourceFile } from './helpers/import-rules.ts';

const ROOT = join(import.meta.dirname, '..');

function readSources(dir: string): SourceFile[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
    .map((entry) => {
      const full = join(entry.parentPath, entry.name);
      return {
        path: relative(ROOT, full).split(sep).join('/'),
        source: readFileSync(full, 'utf8'),
      };
    });
}

describe('layer rules in src/', () => {
  it('has no forbidden imports', () => {
    const files = readSources(join(ROOT, 'src'));
    assert.ok(files.length > 0, 'expected to find source files');
    assert.deepEqual(findViolations(files), []);
  });
});

describe('import rule checker', () => {
  it('maps paths to layers', () => {
    assert.equal(layerOf('src/App.tsx'), 'app');
    assert.equal(layerOf('src/core/game.ts'), 'core');
    assert.equal(layerOf('src/online/firebase/backend.ts'), 'online');
    assert.equal(layerOf('src/unknown/x.ts'), null);
    assert.equal(layerOf('tests/x.test.ts'), null);
  });

  it('finds static, side-effect, re-export, type-only and dynamic imports', () => {
    const source = `
      import a from 'a';
      import type { B } from 'b';
      import {
        c,
      } from 'c';
      import 'd';
      export * from 'e';
      const f = await import('f');
      // import 'commented-out';
      /* import 'block-comment'; */
    `;
    assert.deepEqual(importsOf(source).sort(), ['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('allows chess.js only in core', () => {
    const imports = "import { Chess } from 'chess.js';";
    assert.deepEqual(findViolations([{ path: 'src/core/game.ts', source: imports }]), []);
    for (const path of ['src/board/Board.tsx', 'src/views/PlayView.tsx', 'src/state/match.ts']) {
      const violations = findViolations([{ path, source: imports }]);
      assert.equal(violations.length, 1, path);
      assert.match(violations[0]?.reason ?? '', /chess\.js/);
    }
  });

  it('allows Firebase only in src/online/firebase/', () => {
    const imports = "import { getDatabase } from 'firebase/database';";
    assert.deepEqual(
      findViolations([{ path: 'src/online/firebase/backend.ts', source: imports }]),
      [],
    );
    assert.equal(findViolations([{ path: 'src/online/session.ts', source: imports }]).length, 1);
    assert.equal(findViolations([{ path: 'src/views/Lobby.tsx', source: imports }]).length, 1);
  });

  it('keeps React out of core, ai, online and state', () => {
    const imports = "import { useState } from 'react';";
    for (const path of ['src/core/a.ts', 'src/ai/a.ts', 'src/online/a.ts', 'src/state/a.ts']) {
      assert.equal(findViolations([{ path, source: imports }]).length, 1, path);
    }
    assert.deepEqual(findViolations([{ path: 'src/views/a.tsx', source: imports }]), []);
  });

  it('enforces the direction between layers', () => {
    const check = (path: string, specifier: string) =>
      findViolations([{ path, source: `import x from '${specifier}';` }]).length;
    assert.equal(check('src/core/game.ts', '../state/match.ts'), 1);
    assert.equal(check('src/core/game.ts', './position.ts'), 0);
    assert.equal(check('src/online/session.ts', '../core/game.ts'), 0);
    assert.equal(check('src/online/session.ts', '../ai/engine.ts'), 1);
    assert.equal(check('src/views/PlayView.tsx', '../state/match.ts'), 0);
    assert.equal(check('src/views/PlayView.tsx', '../online/session.ts'), 1);
    assert.equal(check('src/views/PlayView.tsx', '../ai/engine.ts'), 1);
    assert.equal(check('src/state/match.ts', '../views/PlayView.tsx'), 1);
    assert.equal(check('src/App.tsx', './views/HomeView.tsx'), 0);
    assert.equal(check('src/core/game.ts', '../../tests/helpers/x.ts'), 1);
  });
});
