// A small simulator of Firebase Realtime Database security rules, so that every write in
// the online tests goes through database.rules.json.
//
// It models the documented semantics: `.write` grants cascade down (any rule at the
// path or above that evaluates true allows the write); `.validate` rules run for every
// non-null node of the new data at and below each written path, and on its ancestors;
// a wildcard `$name` matches any key without a literal rule; an expression that throws
// counts as false. Expressions are evaluated as JavaScript with a RuleDataSnapshot-like
// API. It is not the official engine: after large rule changes, also try them in the
// Firebase console's Rules Playground.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyUpdates,
  getAt,
  resolveServerTime,
  splitPath,
  type Tree,
} from '../../src/online/tree.ts';

type RuleNode = { [key: string]: RuleNode | string | boolean | string[] };

// Firebase rule strings have `.matches(regex)`; JavaScript strings do not.
if (!('matches' in String.prototype)) {
  Object.defineProperty(String.prototype, 'matches', {
    value(this: string, pattern: RegExp) {
      return pattern.test(this);
    },
    configurable: true,
  });
}

class Snapshot {
  readonly #root: unknown;
  readonly #path: readonly string[];

  constructor(root: unknown, path: readonly string[]) {
    this.#root = root;
    this.#path = path;
  }

  val(): unknown {
    return getAt(this.#root, this.#path);
  }

  child(path: string): Snapshot {
    return new Snapshot(this.#root, [...this.#path, ...splitPath(String(path))]);
  }

  parent(): Snapshot {
    return new Snapshot(this.#root, this.#path.slice(0, -1));
  }

  exists(): boolean {
    return this.val() !== null;
  }

  hasChild(path: string): boolean {
    return this.child(path).exists();
  }

  hasChildren(keys?: readonly string[]): boolean {
    const value = this.val();
    if (typeof value !== 'object' || value === null) return false;
    return keys ? keys.every((key) => this.child(key).exists()) : Object.keys(value).length > 0;
  }

  isString(): boolean {
    return typeof this.val() === 'string';
  }

  isNumber(): boolean {
    return typeof this.val() === 'number';
  }

  isBoolean(): boolean {
    return typeof this.val() === 'boolean';
  }
}

export interface Auth {
  readonly uid: string;
}

/** The query parameters a read rule sees as `query`. */
export interface ReadQuery {
  readonly orderByChild?: string;
  readonly limitToFirst?: number;
  readonly limitToLast?: number;
}

export class PermissionDenied extends Error {
  constructor(path: string, reason: string) {
    super(`PERMISSION_DENIED at /${path}: ${reason}`);
    this.name = 'PermissionDenied';
  }
}

interface Match {
  readonly node: RuleNode;
  readonly vars: Record<string, string>;
}

const RULES_FILE = join(import.meta.dirname, '..', '..', 'database.rules.json');

export class RulesDatabase {
  readonly #rules: RuleNode;
  #data: Tree = {};

  constructor(rulesJson: string = readFileSync(RULES_FILE, 'utf8')) {
    this.#rules = (JSON.parse(rulesJson) as { rules: RuleNode }).rules;
  }

  get data(): Tree {
    return this.#data;
  }

  /** Seed data directly, bypassing rules (test setup only). */
  seed(data: Tree): void {
    this.#data = structuredClone(data);
  }

  read(auth: Auth | null, path: string, now: number, query: ReadQuery = {}): unknown {
    const parts = splitPath(path);
    const chain = this.#chain(parts);
    const allowed = chain.some(({ match, depth }) =>
      this.#evaluate(match?.node['.read'], {
        auth,
        now,
        path: parts.slice(0, depth),
        newRoot: this.#data,
        vars: match?.vars ?? {},
        query,
      }),
    );
    if (!allowed) throw new PermissionDenied(path, 'read');
    return getAt(this.#data, parts);
  }

  update(auth: Auth | null, updates: Record<string, unknown>, now: number): void {
    const resolved = resolveServerTime(updates, now) as Record<string, unknown>;
    const newRoot = applyUpdates(this.#data, resolved);

    for (const path of Object.keys(resolved)) {
      const parts = splitPath(path);
      const chain = this.#chain(parts);
      const writable = chain.some(({ match, depth }) =>
        this.#evaluate(match?.node['.write'], {
          auth,
          now,
          path: parts.slice(0, depth),
          newRoot,
          vars: match?.vars ?? {},
        }),
      );
      if (!writable) throw new PermissionDenied(path, 'write');

      // Ancestors (and the path itself) …
      for (const { match, depth } of chain) {
        this.#validate(match, parts.slice(0, depth), auth, now, newRoot);
      }
      // … and every node below the written path.
      const last = chain.at(-1)?.match ?? null;
      this.#validateBelow(last, parts, auth, now, newRoot);
    }
    this.#data = newRoot;
  }

  /** Rule nodes matched from the root down to `parts` (index = depth). */
  #chain(parts: readonly string[]): { match: Match | null; depth: number }[] {
    const chain: { match: Match | null; depth: number }[] = [
      { match: { node: this.#rules, vars: {} }, depth: 0 },
    ];
    let current: Match | null = { node: this.#rules, vars: {} };
    parts.forEach((part, index) => {
      current = current ? this.#childRule(current, part) : null;
      chain.push({ match: current, depth: index + 1 });
    });
    return chain;
  }

  #childRule(parent: Match, key: string): Match | null {
    const literal = parent.node[key];
    if (typeof literal === 'object' && !Array.isArray(literal)) {
      return { node: literal, vars: parent.vars };
    }
    for (const [name, child] of Object.entries(parent.node)) {
      if (name.startsWith('$') && typeof child === 'object' && !Array.isArray(child)) {
        return { node: child, vars: { ...parent.vars, [name]: key } };
      }
    }
    return null;
  }

  #validate(
    match: Match | null,
    path: readonly string[],
    auth: Auth | null,
    now: number,
    newRoot: Tree,
  ): void {
    if (!match || getAt(newRoot, path) === null) return;
    const rule = match.node['.validate'];
    if (rule === undefined) return;
    if (!this.#evaluate(rule, { auth, now, path, newRoot, vars: match.vars })) {
      throw new PermissionDenied(path.join('/'), `validate: ${String(rule)}`);
    }
  }

  #validateBelow(
    match: Match | null,
    path: readonly string[],
    auth: Auth | null,
    now: number,
    newRoot: Tree,
  ): void {
    const value = getAt(newRoot, path);
    if (!match || typeof value !== 'object' || value === null) return;
    for (const key of Object.keys(value)) {
      const child = this.#childRule(match, key);
      this.#validate(child, [...path, key], auth, now, newRoot);
      this.#validateBelow(child, [...path, key], auth, now, newRoot);
    }
  }

  #evaluate(
    rule: RuleNode[string] | undefined,
    context: {
      auth: Auth | null;
      now: number;
      path: readonly string[];
      newRoot: Tree;
      vars: Record<string, string>;
      query?: ReadQuery;
    },
  ): boolean {
    if (rule === undefined) return false;
    if (typeof rule === 'boolean') return rule;
    if (typeof rule !== 'string') return false;
    const names = Object.keys(context.vars);
    try {
      const fn = new Function(
        'auth',
        'now',
        'root',
        'data',
        'newData',
        'query',
        ...names,
        `return (${rule});`,
      ) as (...args: unknown[]) => unknown;
      return (
        fn(
          context.auth,
          context.now,
          new Snapshot(this.#data, []),
          new Snapshot(this.#data, context.path),
          new Snapshot(context.newRoot, context.path),
          { orderByChild: null, limitToFirst: null, limitToLast: null, ...context.query },
          ...names.map((name) => context.vars[name]),
        ) === true
      );
    } catch {
      return false;
    }
  }
}
