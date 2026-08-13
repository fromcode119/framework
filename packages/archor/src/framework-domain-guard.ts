/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Keeps business-domain knowledge out of the framework.
 *
 * The framework is domain-agnostic: it cannot know what a currency is, nor which extensions are
 * installed. It shipped a money formatter anyway, guessing symbol placement and decimal count, and every
 * caller inherited the guess.
 *
 * This guard names nothing. It matches SHAPES — an Intl currency call, a money-formatting signature —
 * never any domain's words.
 *
 * It deliberately does NOT try to catch domain names in prose. Two attempts failed and both failures are
 * worth recording. A hand-written list of extension names put the exact coupling being banned into the
 * file doing the banning, and had to exempt itself from its own check. Reading those names off disk
 * instead produced 369 false positives, because the names collide head-on with ordinary framework
 * vocabulary — this workspace alone owns a marketplace subsystem and a plugin manager, and the words
 * `search`, `privacy` and `forms` appear everywhere.
 *
 * So domain vocabulary in comments is a REVIEW concern, not a lint. Automating it requires either the
 * hardcoded list this rule forbids, or an alarm nobody can hear.
 */
export class FrameworkDomainGuard {
  /** Framework source roots to police. */
  private static readonly SOURCE_DIRS = [
    'packages/core/src',
    'packages/api/src',
    'packages/react/src',
    'packages/admin/components',
    'packages/admin/lib',
    'packages/frontend/components',
    'packages/sdk/src',
  ];

  /**
   * Structural rules — patterns that are wrong regardless of what is installed. These describe SHAPES
   * (an Intl currency call, a money-formatting signature), never a domain's words.
   */
  private static readonly RULES: ReadonlyArray<{ id: string; test: RegExp; why: string }> = [
    {
      id: 'currency-formatting',
      test: /style\s*:\s*['"]currency['"]/,
      why: "Intl currency formatting — the framework cannot know the operator's symbol, side or decimals",
    },
    {
      id: 'money-helper',
      test: /\b(formatMoney|formatCurrency|formatAmount)\s*\(/,
      why: 'a money formatter — money belongs to the extension that owns the domain',
    },
  ];

  private static readonly SKIP_DIR = /(^|\/)(node_modules|dist|\.next|tests?|__tests__)(\/|$)/;
  private static readonly SKIP_FILE = /\.(test|spec)\.[tj]sx?$/;

  /** Strip comments and imports so prose and module specifiers never trip a structural rule. */
  private static strip(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .replace(/^\s*import\s.*$/gm, '');
  }

  private static walk(dir: string, out: string[]): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!FrameworkDomainGuard.SKIP_DIR.test(full)) FrameworkDomainGuard.walk(full, out);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !FrameworkDomainGuard.SKIP_FILE.test(entry.name)) {
        out.push(full);
      }
    }
  }

  /** Run the check; returns the process exit code (0 = clean). */
  static run(): number {
    const root = process.cwd();
    const files: string[] = [];
    for (const dir of FrameworkDomainGuard.SOURCE_DIRS) {
      FrameworkDomainGuard.walk(path.join(root, dir), files);
    }

    const findings: string[] = [];
    for (const file of files) {
      const rel = path.relative(root, file);
      const stripped = FrameworkDomainGuard.strip(fs.readFileSync(file, 'utf8'));

      stripped.split('\n').forEach((line, index) => {
        for (const rule of FrameworkDomainGuard.RULES) {
          if (rule.test.test(line)) findings.push(`${rel}:${index + 1}  [${rule.id}] ${rule.why}`);
        }
      });
    }

    const mode = process.env.FRAMEWORK_DOMAIN_MODE === 'warn' ? 'warn' : 'error';

    if (!findings.length) {
      console.log(`Framework domain-boundary check passed (${files.length} files).`);
      return 0;
    }

    console.log(`Framework domain-boundary: ${findings.length} finding(s) — domain knowledge in framework code:`);
    findings.forEach((finding) => console.log(`  ${finding}`));
    console.log('\nMove it to the extension that owns the domain and expose it through that extension\'s API.');

    return mode === 'error' ? 1 : 0;
  }
}
