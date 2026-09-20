/* eslint-disable */
import fs from 'node:fs';
import { SourceTree } from './source-tree';

/**
 * A static `t('some.key')` that resolves to no key in any locale file.
 *
 * `t()` falls back to echoing the key, so a dead reference renders as `checkout.errors.someKey` on the
 * page and nothing anywhere reports it. That fallback is why this has to be checked rather than
 * noticed.
 *
 * DELTA ONLY. The count is meaningful against itself between two runs, not as an absolute: a key
 * assembled at runtime cannot be resolved by reading source, and a locale file may legitimately live
 * somewhere this does not look. It reports and never gates for that reason.
 */
export class I18nKeyResolutionGuard {
  private static readonly SKIP = new Set(['ui', 'ui-ssr']);

  /** Every dotted path declared anywhere in a locale JSON file, flattened. */
  private static knownKeys(): Set<string> {
    const known = new Set<string>();

    const flatten = (node: unknown, prefix: string): void => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        const full = prefix ? `${prefix}.${key}` : key;
        known.add(full);
        flatten(value, full);
      }
    };

    for (const { dir } of SourceTree.areas()) {
      for (const file of SourceTree.files(dir, (name) => name.endsWith('.json'), I18nKeyResolutionGuard.SKIP)) {
        if (!/i18n[\\/][^\\/]+\.json$/.test(file)) continue;
        try {
          flatten(JSON.parse(fs.readFileSync(file, 'utf8')), '');
        } catch {
          // A malformed locale file is a different fault, reported by whatever loads it.
        }
      }
    }

    return known;
  }

  static run(): number {
    const known = I18nKeyResolutionGuard.knownKeys();
    const unresolved: string[] = [];

    for (const file of SourceTree.typescript(I18nKeyResolutionGuard.SKIP)) {
      const source = SourceTree.lines(file).join('\n');
      for (const match of source.matchAll(/\b(?:t|tr|translate)\(\s*(['"])([A-Za-z][A-Za-z0-9_.]*)\1/g)) {
        const key = match[2]!;

        // A bare word is almost never an i18n path — `t('yes')` is far more likely a local helper.
        if (!key.includes('.')) continue;

        // A key may be stored bare or under a plugin-slug prefix; either resolves.
        const resolved = known.has(key)
          || [...known].some((candidate) => key.endsWith(`.${candidate}`) || candidate.endsWith(`.${key}`));
        if (!resolved) unresolved.push(`${SourceTree.cite(file)}  ${key}`);
      }
    }

    console.log(`Known locale keys: ${known.size} | unresolved static refs: ${unresolved.length}`);
    for (const miss of unresolved.slice(0, 8)) console.log(`  ${miss}`);
    if (unresolved.length > 8) console.log(`  … and ${unresolved.length - 8} more`);
    console.log('Read this as a DELTA against the previous run — a key built at runtime cannot be resolved from source.');
    return 0;
  }
}
