import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { DictionaryParityGuard } from './dictionary-parity-guard';

/**
 * A key an extension's screens ask for that no dictionary answers.
 *
 * `t('shop.orders.title', {}, 'Orders')` renders its English fallback when the key is missing — in
 * every language, forever, and nothing on screen says so. That is how a whole dashboard stayed English
 * in a Bulgarian console while its Bulgarian sat in the dictionary under a different spelling
 * (`by_service_title` versus the `byServiceTitle` the code asked for).
 *
 * A static key resolves when it is a key of the extension's `src/ui/i18n/en.json`, a key of its server
 * dictionary `src/i18n/en.json` under the extension's slug (both as written and with the slug
 * prepended, because a scoped translator adds it), or a key of a framework dictionary the runtime
 * serves to every extension. A key built at runtime cannot be read from source and is not counted.
 */
export class UiKeyResolutionGuard {
  /** Translator calls whose first argument is a dictionary key. */
  private static readonly TRANSLATOR = /(^|\.)(t|tr|label|translate)$/;
  private static readonly KEY = /^[a-z][\w-]*(\.[\w-]+)+$/;
  private static readonly SKIP_DIR = new Set(['node_modules', 'dist', 'ui-ssr', 'i18n', 'tests', '__tests__']);

  private static keysOf(file: string): string[] {
    return fs.existsSync(file) ? Object.keys(DictionaryParityGuard.flatten(JSON.parse(fs.readFileSync(file, 'utf8')))) : [];
  }

  /** Every key of every `i18n/en.json` under the framework's packages — served to every extension. */
  static sharedKeys(frameworkPackages: string): Set<string> {
    const keys = new Set<string>();
    for (const folder of DictionaryParityGuard.folders(frameworkPackages)) {
      for (const key of UiKeyResolutionGuard.keysOf(path.join(folder, 'en.json'))) keys.add(key);
    }
    return keys;
  }

  /** Extension roots under `dir`: a directory with a `manifest.json` whose `src/ui/i18n/en.json` exists. */
  static extensions(dir: string, depth = 2, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    if (fs.existsSync(path.join(dir, 'manifest.json')) && fs.existsSync(path.join(dir, 'src/ui/i18n/en.json'))) {
      out.push(dir);
      return out;
    }
    if (depth === 0) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !UiKeyResolutionGuard.SKIP_DIR.has(entry.name) && !entry.name.startsWith('.')) {
        UiKeyResolutionGuard.extensions(path.join(dir, entry.name), depth - 1, out);
      }
    }
    return out;
  }

  private static sources(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!UiKeyResolutionGuard.SKIP_DIR.has(entry.name)) UiKeyResolutionGuard.sources(full, out);
      } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        out.push(full);
      }
    }
    return out;
  }

  /** `file:line key` for every static key in the extension's `src/ui` that nothing resolves. */
  static unresolvedIn(root: string, shared: ReadonlySet<string>): string[] {
    const slug = String(JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).slug ?? '');
    const known = new Set<string>(shared);
    for (const key of UiKeyResolutionGuard.keysOf(path.join(root, 'src/ui/i18n/en.json'))) known.add(key);
    for (const key of UiKeyResolutionGuard.keysOf(path.join(root, 'src/i18n/en.json'))) known.add(`${slug}.${key}`);
    const resolves = (key: string) => known.has(key) || known.has(`${slug}.${key}`);

    const hits: string[] = [];
    for (const file of UiKeyResolutionGuard.sources(path.join(root, 'src/ui'))) {
      const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && UiKeyResolutionGuard.TRANSLATOR.test(node.expression.getText(sf))) {
          const first = node.arguments[0];
          if (first && ts.isStringLiteralLike(first) && UiKeyResolutionGuard.KEY.test(first.text) && !resolves(first.text)) {
            hits.push(`${path.relative(root, file)}:${sf.getLineAndCharacterOfPosition(first.getStart(sf)).line + 1} ${first.text}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    return hits;
  }
}
