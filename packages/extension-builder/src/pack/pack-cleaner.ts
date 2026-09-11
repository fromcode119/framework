import { Core } from '@extension-builder/core-bridge';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Removes from a staging directory everything that must not ship.
 *
 * Every rule here is a paid-for incident. Do not "simplify" one without reading why it exists:
 * two of them are the difference between a working install and a silent, total failure.
 */
export class PackCleaner {
  /**
   * `tests` and `scripts` are here because an integration script carrying REAL credentials was once
   * published inside a plugin tarball: the file filter strips `*.ts`, so a `*.mjs` helper under
   * `tests/` slipped through untouched.
   */
  private static readonly STRIPPED_DIRS = new Set([
    'node_modules', '.git', '.next', '__MACOSX', 'tests', 'test', '__tests__', 'scripts', '.vscode',
    '.ssh', '.github', '.circleci',
  ]);

  /** Source and local-only files. */
  private static readonly STRIPPED_SUFFIXES = ['.ts', '.tsx', '.js.map'];

  private static readonly STRIPPED_NAMES = new Set([
    'tsconfig.json', '.DS_Store',
    // Credential-bearing. tar SHIPS dotfiles (unlike the ZIP packer, which globs with dot:false),
    // so `.npmrc` — a registry auth token — was travelling inside published plugin tarballs.
    '.npmrc', '.yarnrc', '.yarnrc.yml', '.netrc', '.git-credentials', '.localcredentials', '.env',
  ]);

  private static readonly STRIPPED_KEY_SUFFIXES = ['.pem', '.key', '.p12', '.pfx'];

  static clean(dir: string): void {
    PackCleaner.walk(dir, dir);
    PackCleaner.cleanUiSsr(dir);

    // `src/ui` is BUILD INPUT and nothing in a shipped package can reach it: its components are
    // `.tsx` (stripped above) and its stylesheets and `i18n/*.json` are imported INTO the bundle at
    // build time, not read from disk. What the runtime serves is `ui/`. Leaving it in shipped 13
    // dead stylesheets and a skeleton of empty folders in every install.
    //
    // `src/i18n` and `src/templates` are a DIFFERENT matter and must stay: registerTranslations()
    // and the Handlebars template loader both read those from disk at runtime.
    fs.rmSync(path.join(dir, 'src', 'ui'), { recursive: true, force: true });

    PackCleaner.removeEmptyDirectories(dir);
  }

  private static walk(current: string, root: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (PackCleaner.STRIPPED_DIRS.has(entry.name)) {
          fs.rmSync(full, { recursive: true, force: true });
          continue;
        }
        PackCleaner.walk(full, root);
        continue;
      }

      if (PackCleaner.shouldStripFile(entry.name, full, root)) fs.rmSync(full, { force: true });
    }
  }

  private static shouldStripFile(name: string, full: string, root: string): boolean {
    if (PackCleaner.STRIPPED_NAMES.has(name)) return true;
    if (name.startsWith('._') || name.startsWith('.env.')) return true;
    if (name.startsWith('id_rsa') || name.startsWith('id_ed25519')) return true;
    if (PackCleaner.STRIPPED_KEY_SUFFIXES.some((suffix) => name.endsWith(suffix))) return true;
    if (name.includes('.test.') || name.includes('.spec.')) return true;
    if (PackCleaner.STRIPPED_SUFFIXES.some((suffix) => name.endsWith(suffix))) return true;

    // A `*.mjs` outside ui-ssr/ is a dev helper (a tests/*.mjs once leaked real credentials). But
    // `ui-ssr/**/*.mjs` is the SERVER RENDER BUNDLE the frontend imports, and `seed.mjs` is a
    // theme's seed data. Stripping the first shipped every theme and plugin without SSR and blanked
    // the visible content of every prod page's server HTML; stripping the second shipped every
    // theme without a seed.
    if (name.endsWith('.mjs')) {
      const inUiSsr = path.relative(root, full).split(path.sep).includes('ui-ssr');
      return name !== Core.ThemePackageLayout.SEED_ARTIFACT && !inUiSsr;
    }

    return false;
  }

  /**
   * `ui-ssr/` must contain ONLY the server bundle modules — never copied public assets. A publicDir
   * misconfiguration once shipped the site's user uploads inside the theme tarball.
   */
  private static cleanUiSsr(dir: string): void {
    const uiSsr = path.join(dir, 'ui-ssr');
    if (!fs.existsSync(uiSsr)) return;
    for (const entry of fs.readdirSync(uiSsr, { withFileTypes: true })) {
      if (entry.isFile() && !entry.name.endsWith('.mjs')) fs.rmSync(path.join(uiSsr, entry.name), { force: true });
    }
  }

  /**
   * Directories emptied by the filters above — 51 of them per plugin, carrying nothing. Repeated
   * until stable, so a parent left empty by its last child goes too.
   */
  private static removeEmptyDirectories(root: string): void {
    for (;;) {
      if (!PackCleaner.removeEmptyPass(root, root)) return;
    }
  }

  private static removeEmptyPass(current: string, root: string): boolean {
    let removed = false;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(current, entry.name);
      if (PackCleaner.removeEmptyPass(full, root)) removed = true;
      if (fs.readdirSync(full).length === 0) {
        fs.rmdirSync(full);
        removed = true;
      }
    }
    return removed;
  }
}
