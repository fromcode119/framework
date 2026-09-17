import fs from 'node:fs';
import path from 'node:path';

/**
 * WHICH trees a guard run covers.
 *
 * The framework used to guard everything: its own packages, and every plugin, theme and appearance
 * beside it. That is why a per-plugin debt ledger — `{ ecommerce: 23, numerology: 31, … }` — ended up
 * inside `packages/`, and why an exemption for a keyed fragment had to name the themes that use one.
 * The framework names no extension, so it cannot be the thing that counts their violations.
 *
 * An extension guards ITSELF, in its own repository's CI, with this same binary pointed at its own
 * directory. The rules stay here, versioned with the framework that defines them; only the subject
 * changes.
 *
 * Unset means all four areas, because that is what a framework developer running the guards locally
 * means by "run the guards", and because changing that default would quietly narrow every existing
 * invocation.
 */
export class GuardScope {
  /** `framework` | `plugins` | `themes` | `appearance` | an absolute path to one extension. */
  static readonly ENV = 'ARCH_GUARD_SCOPE';

  /** The four trees, in the order the reports have always listed them. */
  private static all(repoRoot: string): { area: string; dir: string }[] {
    return [
      { area: 'plugins', dir: path.join(repoRoot, 'plugins') },
      { area: 'themes', dir: path.join(repoRoot, 'themes') },
      { area: 'appearance', dir: path.join(repoRoot, 'appearance') },
      { area: 'framework', dir: path.join(repoRoot, 'framework', 'Source', 'packages') },
    ];
  }

  /**
   * The roots this run covers.
   *
   * A scope naming ONE EXTENSION still reports under its area (`plugins`, `themes`, `appearance`), so
   * the same baselines and the same wording apply whether a plugin is checked from its own CI or as
   * part of a local sweep. An unreadable or unrecognised scope THROWS rather than silently covering
   * nothing — a guard run that scans an empty set is indistinguishable from a clean one.
   */
  static areas(repoRoot: string): { area: string; dir: string }[] {
    const scope = String(process.env[GuardScope.ENV] ?? '').trim();
    if (!scope) return GuardScope.all(repoRoot);

    const byName = GuardScope.all(repoRoot).filter((entry) => entry.area === scope);
    if (byName.length) return byName;

    const dir = path.resolve(scope);
    if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`[arch-guard] ${GuardScope.ENV}="${scope}" is neither an area nor a directory.`);
    }
    return [{ area: GuardScope.areaOf(dir, repoRoot), dir }];
  }

  /**
   * Which area a directory belongs to, from the tree that holds it.
   *
   * Derived from the parent directory rather than matched against a list of known slugs — the point
   * of this class is that the framework does not hold such a list.
   */
  private static areaOf(dir: string, repoRoot: string): string {
    const parent = path.basename(path.dirname(path.resolve(dir)));
    if (parent === 'plugins' || parent === 'themes' || parent === 'appearance') return parent;
    return path.resolve(dir).startsWith(path.join(repoRoot, 'framework') + path.sep) ? 'framework' : parent;
  }
}
