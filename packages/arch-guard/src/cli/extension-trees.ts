import fs from 'node:fs';
import path from 'node:path';
import { FrameworkRoot } from './framework-root';

/**
 * WHERE the plugins, themes and appearances a run covers are — only ever as that run declares them.
 *
 * The guards used to find extensions by climbing two directories up from the framework root and
 * looking for `plugins/`, `themes/` and `appearance/` there. That is one particular arrangement of
 * directories, not something the framework defines: a checkout laid out any other way was scanned as
 * if it held no extensions at all, and every extension guard reported clean.
 *
 * An extension tree is now either:
 *
 *  - the tree holding the ONE extension named by {@link GuardScope} (`--scope <dir>`), which is how an
 *    extension guards itself from its own repository; or
 *  - declared with the same variables the runtime reads — `PLUGINS_DIR`, `THEMES_DIR`,
 *    `APPEARANCE_DIR` — resolved from the framework root, exactly as the runtime resolves them.
 *
 * Anything else is no tree. Which is said once, out loud, so a run that covered no extension is never
 * mistaken for extensions that passed.
 */
export class ExtensionTrees {
  static readonly AREAS = ['plugins', 'themes', 'appearance'] as const;

  /** The runtime's own name for each tree's directory. */
  private static readonly VARIABLE: Record<string, string> = {
    plugins: 'PLUGINS_DIR',
    themes: 'THEMES_DIR',
    appearance: 'APPEARANCE_DIR',
  };

  /** The scope variable, repeated here rather than imported: `GuardScope` depends on this class. */
  private static readonly SCOPE = 'ARCH_GUARD_SCOPE';

  private static announced = false;

  /** The directory holding this area's extensions, or `null` when this run declares none. */
  static dir(area: string): string | null {
    const scoped = ExtensionTrees.scopedExtension();
    if (scoped) return path.basename(path.dirname(scoped)) === area ? path.dirname(scoped) : null;
    if (String(process.env[ExtensionTrees.SCOPE] ?? '').trim() === 'framework') return null;

    const declared = String(process.env[ExtensionTrees.VARIABLE[area] ?? ''] ?? '').trim();
    if (declared) return path.resolve(FrameworkRoot.find(), declared);
    ExtensionTrees.announce();
    return null;
  }

  /** The declared directories among `areas`, in the order asked for. */
  static dirs(areas: readonly string[] = ExtensionTrees.AREAS): string[] {
    return areas.map((area) => ExtensionTrees.dir(area)).filter((dir): dir is string => dir !== null);
  }

  /**
   * A path as a report shows it: relative to the directory the run was started from.
   *
   * Every guard used to print paths relative to the same guessed parent directory; relative to where
   * the operator stands is the one base that means something without knowing how anything is laid out.
   */
  static show(file: string): string {
    return path.relative(process.cwd(), file).split(path.sep).join('/');
  }

  /** The one extension a directory scope names, or `null` when the scope is an area or unset. */
  private static scopedExtension(): string | null {
    const scope = String(process.env[ExtensionTrees.SCOPE] ?? '').trim();
    if (!scope || scope === 'framework' || (ExtensionTrees.AREAS as readonly string[]).includes(scope)) return null;
    const dir = path.resolve(scope);
    return fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory() ? dir : null;
  }

  private static announce(): void {
    if (ExtensionTrees.announced) return;
    ExtensionTrees.announced = true;
    console.log(
      '[arch-guard] No extension tree declared, so no plugin, theme or appearance is scanned. Declare '
      + 'PLUGINS_DIR, THEMES_DIR and APPEARANCE_DIR, or pass --scope <extension dir>.',
    );
  }
}
