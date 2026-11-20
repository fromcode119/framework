/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { GuardScope } from './cli/guard-scope';
import { ExtensionTrees } from './cli/extension-trees';

/**
 * A colour written into an admin screen instead of taken from the console's tokens.
 *
 * Every surface, text and border of the console resolves through `--fc-*` (see `admin.css`), which is
 * what lets a site's brand, the dark scheme and the shadow switch reach every screen at once. A class
 * like `text-slate-500` or a literal `#4f46e5` in a component opts that element out of all three: it
 * stays the same colour whatever the operator sets, and it is why a plugin's dashboard could sit on a
 * page of one grey while painting itself another.
 *
 * This is a RATCHET, not a pass/fail on the idea: the console carries thousands of these from before
 * the tokens existed, and they come out a screen at a time. The guard records what is there and fails
 * only when the number GROWS — a new screen may not add more.
 *
 * Not counted: `.storefront.tsx` and `*-renderer.tsx` (a customer-facing surface keeps its own
 * colours, by the same rule that lets it keep its own controls), and anything inside a comment.
 */
export class AdminPaletteGuard {
  /** Tailwind's own palette, which the console does not use for anything it can theme. */
  private static readonly PALETTE = /\b(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/g;
  private static readonly HEX = /#[0-9a-fA-F]{6}\b/g;

  /**
   * What was there on 2026-11-18, the day the ratchet went in: 4412 across 335 of the console's
   * screens — the measure of how much of the console cannot follow a brand, a scheme or the shadow
   * switch. The worst single file carried 88. 4352 once the badge moved onto the status tints, 4292 once the activity log did, 4224 once the restore dialog did.
   * Lower it whenever a screen is converted; never raise it.
   */
  private static readonly CEILING = 4224;

  static run(): number {
    const files = AdminPaletteGuard.adminFiles();
    const perFile = new Map<string, number>();
    let total = 0;

    for (const file of files) {
      const source = AdminPaletteGuard.withoutComments(fs.readFileSync(file, 'utf8'));
      const hits = (source.match(AdminPaletteGuard.PALETTE)?.length ?? 0)
        + (source.match(AdminPaletteGuard.HEX)?.length ?? 0);
      if (!hits) continue;
      perFile.set(file, hits);
      total += hits;
    }

    const worst = [...perFile].sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(`Admin palette (colours written into a screen instead of a token): ${total} in ${perFile.size} files, ceiling ${AdminPaletteGuard.CEILING}.`);
    for (const [file, count] of worst) console.log(`  ${count.toString().padStart(4)}  ${ExtensionTrees.show(file)}`);

    if (total > AdminPaletteGuard.CEILING) {
      console.error(
        `\nThis is ${total - AdminPaletteGuard.CEILING} more than the ceiling. A new screen takes its colours from the`
        + '\nconsole tokens: `var(--fc-text)`, `var(--fc-text-muted)`, `var(--fc-surface)`, `var(--fc-border)`,'
        + '\n`var(--fc-brand)` and the status tints — or, better, a class in `admin.css` that names what the'
        + '\nelement IS. Lower the ceiling in this guard when you convert a screen; never raise it.',
      );
      return 1;
    }
    if (total < AdminPaletteGuard.CEILING) {
      console.log(`\n${AdminPaletteGuard.CEILING - total} below the ceiling — lower CEILING to ${total} in admin-palette-guard.ts.`);
    }
    console.log('Admin palette guard passed.');
    return 0;
  }

  /**
   * The console's own screens, minus what is built, installed or customer-facing.
   *
   * The framework area is `<framework>/packages` (see GuardScope.all), so the console is the `admin`
   * directory inside it. A run scoped to an extension has no console to scan and reports 0 files.
   */
  private static adminFiles(): string[] {
    const roots = GuardScope.areas()
      .filter((entry) => entry.area === 'framework')
      .map((entry) => path.join(entry.dir, 'admin'))
      .filter((dir) => fs.existsSync(dir));
    return roots.flatMap((root) => AdminPaletteGuard.walk(root));
  }

  private static walk(dir: string): string[] {
    const skip = new Set(['node_modules', '.next', 'dist', 'tests', 'public', 'service-worker']);
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skip.has(entry.name)) continue;
        out.push(...AdminPaletteGuard.walk(full));
        continue;
      }
      if (!entry.name.endsWith('.tsx')) continue;
      if (entry.name.includes('.storefront.') || entry.name.endsWith('-renderer.tsx')) continue;
      if (entry.name.endsWith('.test.tsx')) continue;
      out.push(full);
    }
    return out;
  }

  /** A colour named in a comment is prose about the past, not a colour on a screen. */
  private static withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  }
}
