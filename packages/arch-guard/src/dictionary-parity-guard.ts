import fs from 'node:fs';
import path from 'node:path';

/**
 * Every language a dictionary folder ships must say everything its English says.
 *
 * A translator falls back to English — and then to the key — when a locale lacks an entry, so a
 * missing translation never breaks a screen: it quietly shows English in a console set to another
 * language, which is exactly the defect this exists to stop at the pull request instead of on a
 * live site. An EMPTY translation is the same defect with a worse symptom (nothing at all).
 *
 * A folder counts when it is named `i18n` and holds an `en.json`; every other `<locale>.json` beside
 * it is checked against that English. Placeholders are deliberately NOT compared here: a language may
 * need a different variable than the English sentence uses (Bulgarian agrees with the collection's
 * gender through `{{label}}` where English says `{{name}}`), and only the code knows what it passes —
 * that is a per-area test's job, not this guard's.
 */
export class DictionaryParityGuard {
  private static readonly SKIP_DIR = new Set(['node_modules', 'dist', '.next', 'ui-ssr', 'coverage', '.git']);

  /** `a.b.c` → text, for every leaf of a nested dictionary. */
  static flatten(node: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
    for (const [key, value] of Object.entries((node ?? {}) as Record<string, unknown>)) {
      const full = prefix ? `${prefix}.${key}` : key;
      if (Object.prototype.toString.call(value) === '[object Object]') DictionaryParityGuard.flatten(value, full, out);
      else out[full] = String(value ?? '');
    }
    return out;
  }

  /** The dictionary folders under `dir`: named `i18n`, holding an `en.json`. */
  static folders(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || DictionaryParityGuard.SKIP_DIR.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === 'i18n' && fs.existsSync(path.join(full, 'en.json'))) out.push(full);
      DictionaryParityGuard.folders(full, out);
    }
    return out;
  }

  /** What one folder's other languages lack, one line per locale with the keys it misses or leaves empty. */
  static problemsIn(folder: string): string[] {
    const en = DictionaryParityGuard.flatten(JSON.parse(fs.readFileSync(path.join(folder, 'en.json'), 'utf8')));
    const problems: string[] = [];
    for (const file of fs.readdirSync(folder).filter((name) => name.endsWith('.json') && name !== 'en.json').sort()) {
      const words = DictionaryParityGuard.flatten(JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8')));
      const missing = Object.keys(en).filter((key) => !(key in words));
      const empty = Object.keys(en).filter((key) => key in words && en[key].trim() !== '' && words[key].trim() === '');
      if (missing.length) problems.push(`${file}: ${missing.length} missing — ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', …' : ''}`);
      if (empty.length) problems.push(`${file}: ${empty.length} empty — ${empty.slice(0, 8).join(', ')}${empty.length > 8 ? ', …' : ''}`);
    }
    return problems;
  }
}
