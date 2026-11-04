// Convert Lichess's chess-openings TSV files (CC0, https://github.com/lichess-org/chess-openings)
// into src/core/data/openings.json: one line per opening as [eco, name, uci moves].
// Usage: node scripts/build-openings.ts <dir with a.tsv … e.tsv> [source date]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Game } from '../src/core/index.ts';

const [dir, date = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
if (!dir) throw new Error('usage: node scripts/build-openings.ts <tsv dir> [date]');

const lines: [string, string, string][] = [];
for (const file of ['a', 'b', 'c', 'd', 'e']) {
  const rows = readFileSync(join(dir, `${file}.tsv`), 'utf8')
    .trim()
    .split('\n')
    .slice(1);
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t');
    if (!eco || !name || !pgn) continue;
    const game = new Game();
    for (const token of pgn.split(/\s+/)) {
      if (/^\d+\.+$/.test(token) || token === '') continue;
      game.playSan(token);
    }
    lines.push([eco, name, game.moves.map((move) => move.uci).join(' ')]);
  }
}
lines.sort((a, b) => a[2].localeCompare(b[2]));

const out = {
  source: 'https://github.com/lichess-org/chess-openings',
  license: 'CC0-1.0',
  retrieved: date,
  lines,
};
writeFileSync(
  join(import.meta.dirname, '..', 'src', 'core', 'data', 'openings.json'),
  JSON.stringify(out) + '\n',
);
console.log(`${lines.length} openings`);
