import fs from 'node:fs';
import path from 'node:path';
import { ExtensionTrees } from './extension-trees';
import { FrameworkRoot } from './framework-root';

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
 * Unset means the framework plus every extension tree the run declares (see {@link ExtensionTrees}).
 */
export class GuardScope {
  /** `framework` | `plugins` | `themes` | `appearance` | an absolute path to one extension. */
  static readonly ENV = 'ARCH_GUARD_SCOPE';

  /** The trees, in the order the reports have always listed them. Extension trees only when declared. */
  private static all(): { area: string; dir: string }[] {
    const framework = FrameworkRoot.find();
    return [
      ...ExtensionTrees.AREAS.flatMap((area) => {
        const dir = ExtensionTrees.dir(area);
        return dir ? [{ area, dir }] : [];
      }),
      { area: 'framework', dir: path.join(framework, 'packages') },
      // `config/` configures the framework (the Next apps' shared env/alias resolution) but sits
      // beside `packages/`, not under it — a blind spot that let next-config-env.ts grow to 448
      // lines, five contracts deep, before anything measured it. A second entry under the SAME
      // 'framework' area, not a fifth area: every guard here accumulates counts per `area` name
      // (see e.g. HardcodedCopyGuard.scan), so this folds into the existing framework totals rather
      // than inventing a new bucket to baseline.
      { area: 'framework', dir: path.join(framework, 'config') },
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
  static areas(): { area: string; dir: string }[] {
    const scope = String(process.env[GuardScope.ENV] ?? '').trim();
    if (!scope) return GuardScope.onDisk(GuardScope.all(), 'the default sweep');

    const byName = GuardScope.all().filter((entry) => entry.area === scope);
    if (byName.length) return GuardScope.onDisk(byName, `${GuardScope.ENV}="${scope}"`);

    if ((ExtensionTrees.AREAS as readonly string[]).includes(scope)) {
      throw new Error(`[arch-guard] ${GuardScope.ENV}="${scope}" names an area this run does not declare.`);
    }
    const dir = path.resolve(scope);
    if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`[arch-guard] ${GuardScope.ENV}="${scope}" is neither an area nor a directory.`);
    }
    return [{ area: GuardScope.areaOf(dir), dir }];
  }

  /**
   * The entries that exist — and a HARD FAILURE when the framework's own source is not among them.
   *
   * Every guard here reports per area, and an area with no files reports `0 — clean`. So a run
   * pointed at a directory that does not exist does not fail: it PASSES, for the same reason an
   * empty room has nothing wrong with it. That is indistinguishable from real success in the log,
   * which is the one thing a guard must never be.
   *
   * It is not hypothetical. The framework paths were once derived from a guessed parent directory,
   * and from a git worktree that guess landed one level short: every framework path pointed at a
   * directory that did not exist, and all eight guards reported clean. A 448-line file planted in
   * `config/` to test exactly this went undetected, and the green that followed would have been
   * trusted.
   *
   * The two kinds of absence are not the same, so they are not treated the same:
   *
   *  - `packages/` and `config/` are the framework's OWN source. If they are missing, the
   *    invocation is wrong — wrong cwd, wrong root — and nothing it reports means anything. Throw.
   *  - An extension tree was DECLARED, so one that does not exist is a broken declaration.
   *    Skipping it would be the silent empty scan again.
   */
  private static onDisk(entries: { area: string; dir: string }[], context: string): { area: string; dir: string }[] {
    const exists = (dir: string): boolean => fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory() === true;
    const fatal = entries.filter((entry) => !exists(entry.dir));

    if (fatal.length) {
      throw new Error(
        `[arch-guard] ${context} resolved to ${fatal.length} director${fatal.length === 1 ? 'y' : 'ies'} that do not exist:\n`
        + fatal.map((entry) => `  ${entry.area}: ${entry.dir}`).join('\n')
        + '\nNothing would be scanned, and every guard would report clean.',
      );
    }
    return entries;
  }

  /**
   * Is this run guarding ONE extension rather than a whole tree?
   *
   * The distinction decides where a baseline comes from. A tree's baseline is the framework's record
   * of its own debt; a single extension's belongs to that extension, in its own repository, next to
   * the code it describes — which is the point of scoping at all.
   */
  static isExtension(): boolean {
    const areas = GuardScope.areas();
    if (areas.length !== 1) return false;
    const [only] = areas;
    return !GuardScope.all().some((entry) => entry.dir === only?.dir);
  }


  /**
   * Which area a directory belongs to, from the tree that holds it.
   *
   * Derived from the parent directory rather than matched against a list of known slugs — the point
   * of this class is that the framework does not hold such a list.
   */
  private static areaOf(dir: string): string {
    const parent = path.basename(path.dirname(path.resolve(dir)));
    if ((ExtensionTrees.AREAS as readonly string[]).includes(parent)) return parent;
    return path.resolve(dir).startsWith(FrameworkRoot.find() + path.sep) ? 'framework' : parent;
  }
}
