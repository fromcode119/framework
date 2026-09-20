/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { FrameworkRoot } from './cli/framework-root';

/**
 * A server bundle must not STATICALLY import the SDK's admin barrel.
 *
 * Server bundles externalise `@fromcode119/*`, so Node resolves those specifiers at runtime — and the
 * admin barrel is a CJS dist whose named exports Node's interop cannot detect; its index also reaches
 * for an admin-app package that does not exist outside the admin. One static
 * `import { X } from '@fromcode119/sdk/admin'` therefore throws at import time and the WHOLE bundle is
 * refused, which costs every storefront page its server-rendered content and says only "SSR bundle not
 * loaded". Silent, total, and invisible in the markup.
 *
 * Only the STATIC graph is scanned — the entry plus every relative chunk it transitively imports.
 * A dynamic import is exempt by construction: it is not in that graph, and deferring the admin
 * component behind one is the supported way to use it.
 *
 * This GATES. Unlike the naming guards it has no judgement in it: the import either throws at runtime
 * or it does not.
 */
export class SsrStaticImportGuard {
  private static readonly STATIC_IMPORT = /^(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/gm;
  private static readonly BARE_IMPORT = /^import\s*["']([^"']+)["']/gm;

  /** The one specifier a server bundle cannot survive importing statically. */
  private static readonly FORBIDDEN = /^@fromcode119\/sdk\/admin$/;

  /** Where a built server bundle sits inside an extension. */
  private static readonly ENTRY = path.join('ui-ssr', 'entry.mjs');

  /** Offending `file -> specifier` pairs across one entry's static graph. */
  static scanEntry(entry: string): string[] {
    const seen = new Set<string>();
    const offenders: string[] = [];

    const walk = (file: string): void => {
      if (seen.has(file) || !fs.existsSync(file)) return;
      seen.add(file);

      let source = '';
      try {
        source = fs.readFileSync(file, 'utf8');
      } catch {
        return;
      }

      for (const pattern of [SsrStaticImportGuard.STATIC_IMPORT, SsrStaticImportGuard.BARE_IMPORT]) {
        for (const match of source.matchAll(pattern)) {
          const specifier = match[1]!;
          if (SsrStaticImportGuard.FORBIDDEN.test(specifier)) offenders.push(`${file} -> ${specifier}`);
          if (specifier.startsWith('.')) walk(path.resolve(path.dirname(file), specifier));
        }
      }
    };

    walk(entry);
    return offenders;
  }

  /** Every built server-bundle entry across the extension trees. */
  private static entries(): string[] {
    const repo = FrameworkRoot.repo();
    const found: string[] = [];

    for (const area of ['plugins', 'themes']) {
      const root = path.join(repo, area);
      let children: fs.Dirent[] = [];
      try {
        children = fs.readdirSync(root, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const child of children) {
        if (!child.isDirectory()) continue;
        const entry = path.join(root, child.name, SsrStaticImportGuard.ENTRY);
        if (fs.existsSync(entry)) found.push(entry);
      }
    }

    return found;
  }

  static run(): number {
    const entries = SsrStaticImportGuard.entries();
    const offenders = entries.flatMap((entry) => SsrStaticImportGuard.scanEntry(entry));

    console.log(`Server bundles scanned: ${entries.length}; static admin-barrel imports: ${offenders.length}`);
    if (!offenders.length) return 0;

    for (const offender of offenders) console.log(`  ${offender}`);
    console.log('A static import of the admin barrel throws at load and the whole bundle is refused.');
    console.log('Reach for the component behind a dynamic import instead.');
    return 1;
  }
}
