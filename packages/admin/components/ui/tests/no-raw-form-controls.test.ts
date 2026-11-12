import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A console screen draws its form controls with the console's own components (`components/ui`), so
 * every field is the one size and look. A raw `<input>`, `<select>` or `<textarea>` in a screen is how
 * a browser-default control, or a field of its own height, gets back in.
 *
 * Allowed: a file input (hidden and opened by a button — not a visible control), and the few places
 * named below, each with the reason it cannot be a component.
 */
const ADMIN_ROOT = join(__dirname, '..', '..', '..');
const SCANNED = ['components', 'app'];
const ALLOWED: Record<string, string> = {
  // The JSON editor: a transparent text area laid over a syntax-highlighted block.
  'components/collection/edit/view/record-json-view.client.tsx': 'textarea',
  // There is no radio component yet.
  'app/settings/appearance/appearance-active-card.tsx': 'input',
};

const filesUnder = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return name === 'tests' || name === 'node_modules' || name.startsWith('.') ? [] : filesUnder(path);
  return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
});

const rawControlsIn = (source: string): string[] => {
  const found: string[] = [];
  for (const match of source.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    if (match[1] === 'input' && /type=["']file["']/.test(match[2])) continue;
    found.push(match[1]);
  }
  return found;
};

describe('console screens use the console form components', () => {
  it('has no raw input, select or textarea outside components/ui', () => {
    const offenders: string[] = [];
    for (const root of SCANNED) {
      for (const file of filesUnder(join(ADMIN_ROOT, root))) {
        const path = relative(ADMIN_ROOT, file).split('\\').join('/');
        if (path.startsWith('components/ui/')) continue;
        const allowedTag = ALLOWED[path];
        const raw = rawControlsIn(readFileSync(file, 'utf8')).filter((tag) => tag !== allowedTag);
        if (raw.length) offenders.push(`${path}: ${raw.join(', ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
