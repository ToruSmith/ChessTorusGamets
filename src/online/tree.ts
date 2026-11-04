// Plain-JSON tree helpers shared by the local backend and the rules simulator in tests.
import { isServerTime } from './types.ts';

export type Tree = Record<string, unknown>;

export function splitPath(path: string): string[] {
  return path.split('/').filter((part) => part.length > 0);
}

export function getAt(tree: unknown, path: string | readonly string[]): unknown {
  let node: unknown = tree;
  for (const part of typeof path === 'string' ? splitPath(path) : path) {
    if (typeof node !== 'object' || node === null) return null;
    node = (node as Tree)[part];
  }
  return node === undefined ? null : node;
}

/** Replace SERVER_TIME placeholders with `now`. */
export function resolveServerTime(value: unknown, now: number): unknown {
  if (isServerTime(value)) return now;
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveServerTime(v, now)]));
}

/** Like Firebase: null and empty objects are absence. */
function clean(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const entries = Object.entries(value)
    .map(([k, v]) => [k, clean(v)] as const)
    .filter(([, v]) => v !== null && v !== undefined);
  return entries.length === 0 ? null : Object.fromEntries(entries);
}

/** Return a new tree with every `path → value` applied (null deletes). */
export function applyUpdates(tree: Tree, updates: Record<string, unknown>): Tree {
  const next = structuredClone(tree);
  for (const [path, value] of Object.entries(updates)) {
    const parts = splitPath(path);
    const last = parts.pop();
    if (last === undefined) continue;
    let node: Tree = next;
    for (const part of parts) {
      const child = node[part];
      if (typeof child !== 'object' || child === null) node[part] = {};
      node = node[part] as Tree;
    }
    node[last] = structuredClone(value);
  }
  return (clean(next) as Tree | null) ?? {};
}
