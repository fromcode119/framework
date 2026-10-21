/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { SourceTree } from './source-tree';
import { ExtensionTrees } from './cli/extension-trees';

/**
 * A non-system plugin collection that does not declare `access.read`.
 *
 * Reading an undeclared collection is refused to everyone but an administrator (fail-closed), so a
 * collection that is meant to be read — a storefront list, a member's own rows — must say so with
 * `access.read` (`true`, or a rule returning a row constraint). One that is not meant to be public
 * should say THAT, with a rule returning false for non-admins, so the intent is on the page rather
 * than in the framework's default.
 *
 * A collection is a class in a plugin's `src/` with both a static `slug` and a static `fields`.
 * `access` assigned from an expression (`static access = Shared.access`) counts as declared; only an
 * object literal is checked for a `read` key.
 */
export class CollectionReadAccessGuard {
  private static readonly SKIP = new Set(['migrations', 'tests']);

  /** The balanced `{…}` starting at `open`, or null. */
  private static balanced(source: string, open: number): string | null {
    let depth = 0;
    for (let at = open; at < source.length; at++) {
      if (source[at] === '{') depth++;
      else if (source[at] === '}' && --depth === 0) return source.slice(open, at + 1);
    }
    return null;
  }

  /** Why this collection fails, or null when it declares `access.read`. */
  private static verdict(source: string): string | null {
    const declaration = /static\s+(?:readonly\s+)?access\s*(?::[^=]+)?=\s*/.exec(source);
    if (!declaration) return 'no static access — read is admin-only by default';

    const rest = source.slice(declaration.index + declaration[0].length);
    if (!rest.startsWith('{')) return null;

    const literal = CollectionReadAccessGuard.balanced(source, declaration.index + declaration[0].length);
    if (literal && !/(^|[\s{,])read\s*[:(,}]|\bread\b\s*$/m.test(literal)) {
      return 'static access declares no read — read is admin-only by default';
    }
    return null;
  }

  static run(): number {
    const pluginsDir = ExtensionTrees.dir('plugins');
    if (!pluginsDir) return 0;
    const findings: string[] = [];
    let scanned = 0;

    let plugins: fs.Dirent[] = [];
    try {
      plugins = fs.readdirSync(pluginsDir, { withFileTypes: true });
    } catch {
      console.log(`No plugins directory at ${pluginsDir}; nothing to scan.`);
      return 0;
    }

    for (const plugin of plugins) {
      if (!plugin.isDirectory()) continue;
      const src = path.join(pluginsDir, plugin.name, 'src');
      if (!fs.existsSync(src)) continue;

      const files = SourceTree.files(
        src,
        (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
        CollectionReadAccessGuard.SKIP,
      );

      for (const file of files) {
        const source = SourceTree.lines(file).join('\n');
        const slug = /static\s+(?:readonly\s+)?slug\b/.exec(source);
        if (!slug || !/static\s+(?:readonly\s+)?fields\b/.test(source)) continue;
        if (/static\s+(?:readonly\s+)?system\s*=\s*true/.test(source)) continue;

        scanned++;
        const why = CollectionReadAccessGuard.verdict(source);
        if (!why) continue;

        const line = source.slice(0, slug.index).split('\n').length;
        findings.push(`  ${plugin.name.padEnd(18)} ${SourceTree.cite(file)}:${line}\n  ${''.padEnd(18)} ${why}`);
      }
    }

    console.log(`Scanned ${scanned} non-system plugin collection(s).`);
    if (!findings.length) {
      console.log('OK — every plugin collection declares access.read.');
      return 0;
    }

    console.log(`\n${findings.length} collection(s) without access.read:\n`);
    for (const finding of findings) console.log(finding);
    console.log('\nDeclare access.read: true (public), a row-scoping rule, or a rule returning false for non-admins.');
    return 1;
  }
}
