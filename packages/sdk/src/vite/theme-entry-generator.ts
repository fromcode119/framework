import fs from 'node:fs';
import path from 'node:path';

/**
 * Writes the Vite entry module for a theme from the patterns the THEME declares.
 *
 * Contains no knowledge of what a theme puts where. It does not know about CMS, renderers, overrides,
 * plugins, styles directories or any other layout: it reads arrays of glob strings out of `theme.json`
 * and emits the `import.meta.glob` calls for them. Naming a directory convention here would weld one
 * theme's layout into the framework, which is exactly what this replaced.
 *
 * Why a generated file exists at all: Vite resolves `import.meta.glob` at BUILD time and requires the
 * literal to appear in the module it compiles, so the patterns cannot live behind a function call in
 * `ThemeBoot`. A theme used to hand-author `src/index.jsx` carrying that machinery — raw glob calls plus
 * hardcoded `!./path/to/one-file.tsx` exclusions. Now the theme states intent and ships no entry file:
 *
 *   "build": {
 *     "styles":          [ …globs, imported for side effect… ],
 *     "components":      [ …globs, imported lazily… ],
 *     "eagerComponents": [ …globs, bundled eagerly and excluded from the lazy set… ]
 *   }
 *
 * What those globs point at is the theme's business, not this class's.
 *
 * The entry is written into the theme's own `src/` rather than a Vite virtual module because
 * `import.meta.glob` patterns resolve relative to the importing file.
 */
export class ThemeEntryGenerator {
  /**
   * The generated file, written into `<themeDir>/src/` and removed after the build.
   *
   * NOT dot-prefixed: with a leading dot Vite emitted the entry as its own chunk and left `bundle.js` as
   * a 71-byte re-export shim, changing what the theme loader receives.
   */
  static readonly ENTRY_FILENAME = 'theme-entry.generated.jsx';

  static entryPath(themeDir: string): string {
    return path.join(themeDir, 'src', ThemeEntryGenerator.ENTRY_FILENAME);
  }

  /** `theme.json` → `build`, or an empty object when the theme declares none. */
  private static readBuildConfig(themeDir: string): Record<string, unknown> {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(themeDir, 'theme.json'), 'utf8'));
      const build = manifest?.build;
      return build && typeof build === 'object' ? build as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  /** A declared glob list, normalised. Accepts a single string or an array; ignores anything else. */
  private static patterns(build: Record<string, unknown>, key: string): string[] {
    const raw = build[key];
    const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : []);
    return list
      .map((value: unknown) => String(value ?? '').trim())
      .filter((value: string) => value.length > 0);
  }

  /**
   * The entry Vite should compile for this theme.
   *
   * A theme that ships its own `src/index.jsx` keeps it — not every theme is built from declared glob
   * lists (snapbilt-theme hand-writes a 54KB entry), and generating over it would break its build.
   */
  static resolveEntry(themeDir: string): string {
    const authored = path.join(themeDir, 'src', 'index.jsx');
    if (fs.existsSync(authored)) return authored;
    return ThemeEntryGenerator.generate(themeDir);
  }

  /**
   * The boot the generated entry hands its component maps to.
   *
   * This is the theme ENTRY CONTRACT, not a layout assumption — but it is still overridable per theme
   * (`build.boot: { module, className, method }`) so the framework asserts nothing a theme cannot change.
   */
  private static boot(build: Record<string, unknown>): { module: string; className: string; method: string } {
    const declared = (build.boot && typeof build.boot === 'object') ? build.boot as Record<string, unknown> : {};
    const value = (key: string, fallback: string): string => {
      const raw = String(declared[key] ?? '').trim();
      return raw.length ? raw : fallback;
    };
    return {
      module: value('module', '@theme/theme-boot'),
      className: value('className', 'ThemeBoot'),
      method: value('method', 'start'),
    };
  }

  /** Writes the entry and returns its path. Idempotent — safe to call before every build. */
  static generate(themeDir: string): string {
    const build = ThemeEntryGenerator.readBuildConfig(themeDir);
    const styles = ThemeEntryGenerator.patterns(build, 'styles');
    const components = ThemeEntryGenerator.patterns(build, 'components');
    const eager = ThemeEntryGenerator.patterns(build, 'eagerComponents');
    const boot = ThemeEntryGenerator.boot(build);
    // An eagerly-bundled module must be EXCLUDED from the lazy glob, or it lands in both graphs.
    const lazy = [...components, ...eager.map((pattern) => `!${pattern}`)];

    const glob = (list: string[], eagerFlag: boolean): string =>
      (list.length
        ? `import.meta.glob(${JSON.stringify(list)}${eagerFlag ? ', { eager: true }' : ''});`
        : 'Object.freeze({});');

    const source = `// GENERATED from theme.json ("build") by the framework theme build — do not edit, do not commit.
// Every pattern and the boot target below are declared by the THEME; the framework supplies none of them.
import { ${boot.className} } from '${boot.module}'

export class ThemeEntry {
  static styles = ${glob(styles, true)}

  static components = ${glob(lazy, false)}

  static eagerComponents = ${glob(eager, true)}

  static {
    ${boot.className}.${boot.method}(ThemeEntry.components, ThemeEntry.eagerComponents);
  }
}
`;
    const target = ThemeEntryGenerator.entryPath(themeDir);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source, 'utf8');
    return target;
  }

  static remove(themeDir: string): void {
    try {
      fs.unlinkSync(ThemeEntryGenerator.entryPath(themeDir));
    } catch {
      /* already gone */
    }
  }
}
