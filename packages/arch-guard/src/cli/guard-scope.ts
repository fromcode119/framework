import fs from 'node:fs';
import path from 'node:path';

/**
 * WHICH trees a guard run covers.
 *
 * The framework used to guard everything: its own packages, and every plugin, theme and appearance
 * beside it. That is why a per-plugin debt ledger — one line per slug — ended up inside `packages/`, and why
 * an exemption for a keyed fragment had to name the themes that use one.
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
      // `config/` configures the framework (the Next apps' shared env/alias resolution) but sits
      // beside `packages/`, not under it — a blind spot that let next-config-env.ts grow to 448
      // lines, five contracts deep, before anything measured it. A second entry under the SAME
      // 'framework' area, not a fifth area: every guard here accumulates counts per `area` name
      // (see e.g. HardcodedCopyGuard.scan), so this folds into the existing framework totals rather
      // than inventing a new bucket to baseline.
      { area: 'framework', dir: path.join(repoRoot, 'framework', 'Source', 'config') },
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
    if (!scope) return GuardScope.onDisk(GuardScope.all(repoRoot), 'the default sweep');

    const byName = GuardScope.all(repoRoot).filter((entry) => entry.area === scope);
    if (byName.length) return GuardScope.onDisk(byName, `${GuardScope.ENV}="${scope}"`);

    const dir = path.resolve(scope);
    if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`[arch-guard] ${GuardScope.ENV}="${scope}" is neither an area nor a directory.`);
    }
    return [{ area: GuardScope.areaOf(dir, repoRoot), dir }];
  }

  /**
   * The entries that exist — and a HARD FAILURE when the framework's own source is not among them.
   *
   * Every guard here reports per area, and an area with no files reports `0 — clean`. So a run
   * pointed at a directory that does not exist does not fail: it PASSES, for the same reason an
   * empty room has nothing wrong with it. That is indistinguishable from real success in the log,
   * which is the one thing a guard must never be.
   *
   * It is not hypothetical. `repoRoot` is derived as `cwd/../..`, which only resolves when the
   * command runs from `framework/Source`. From a git worktree it resolves one level short, every
   * framework path becomes `framework/framework/Source/...`, and all eight guards report clean. A
   * 448-line file planted in `config/` to test exactly this went undetected, and the green that
   * followed would have been trusted.
   *
   * The two kinds of absence are not the same, so they are not treated the same:
   *
   *  - `packages/` and `config/` are the framework's OWN source. If they are missing, the
   *    invocation is wrong — wrong cwd, wrong root — and nothing it reports means anything. Throw.
   *  - `plugins/`, `themes/` and `appearance/` are extension trees that legitimately are not
   *    checked out beside a standalone framework clone. Absent is a fact about that checkout, not
   *    an error, so they are skipped quietly.
   *
   * Asking for an area BY NAME is different again: naming `plugins` when there is no `plugins/`
   * is a broken request, and `context` says which invocation to blame.
   */
  private static onDisk(entries: { area: string; dir: string }[], context: string): { area: string; dir: string }[] {
    const exists = (dir: string): boolean => fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory() === true;
    const missing = entries.filter((entry) => !exists(entry.dir));
    const fatal = missing.filter((entry) => entry.area === 'framework' || entries.length === 1);

    if (fatal.length) {
      throw new Error(
        `[arch-guard] ${context} resolved to ${fatal.length} director${fatal.length === 1 ? 'y' : 'ies'} that do not exist:\n`
        + fatal.map((entry) => `  ${entry.area}: ${entry.dir}`).join('\n')
        + '\nNothing would be scanned, and every guard would report clean. Run from framework/Source.',
      );
    }
    return entries.filter((entry) => exists(entry.dir));
  }

  /**
   * Is this run guarding ONE extension rather than a whole tree?
   *
   * The distinction decides where a baseline comes from. A tree's baseline is the framework's record
   * of its own debt; a single extension's belongs to that extension, in its own repository, next to
   * the code it describes — which is the point of scoping at all.
   */
  static isExtension(repoRoot: string): boolean {
    const areas = GuardScope.areas(repoRoot);
    if (areas.length !== 1) return false;
    const [only] = areas;
    return !GuardScope.all(repoRoot).some((entry) => entry.dir === only?.dir);
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
