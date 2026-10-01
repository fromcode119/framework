import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * The frontend has no Tailwind pipeline (see app/globals.css), so a utility class on these pages is
 * inert text and the page renders as bare HTML. Their design is the framework's `fc-auth__*` classes
 * in app/auth.css — the same ones the AuthShell forms use and themes rebrand.
 */
const PAGES = ['register', 'forgot-password', 'reset-password', 'verify-email', 'verify-email-change'];
const UTILITY = /\b(?:min-h-screen|mx-auto|max-w-\w+|px-\d|py-\d|mt-\d|space-y-\d|rounded-(?:lg|xl|2xl)|bg-(?:slate|indigo|emerald|rose)-\d+|text-(?:slate|indigo|emerald|rose)-\d+|border-(?:slate|emerald|rose)-\d+|grid-cols-\d|inline-flex)\b/;

describe('the default auth pages use the framework auth styles', () => {
  for (const page of PAGES) {
    it(page, () => {
      const dir = join(__dirname, '..', 'app', page, 'components', 'view');
      for (const file of readdirSync(dir).filter((name) => name.endsWith('.tsx'))) {
        const source = readFileSync(join(dir, file), 'utf8');
        expect(source.match(UTILITY)?.[0], `${page}/${file}`).toBeUndefined();
        expect(source, `${page}/${file}`).toContain('fc-auth__');
      }
    });
  }
});
