import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Fails when compiler output (`.js` / `.js.map` / `.d.ts`) is sitting inside a package's `src`.
 *
 * Build output belongs in `dist`. When it lands beside the sources instead — which is what `tsc <path>`
 * does, because a positional argument makes it ignore `tsconfig.json` and therefore `outDir` — the stray
 * `foo.enum.js` shadows `foo.enum.ts` for some importers and not others. You then get TWO module instances
 * of the same class, `Enum` reference identity breaks, and the failures name enums rather than the build.
 *
 * Lives in typor because it guards tsc's own output contract.
 */
export class SrcArtifactGuard {
  private static readonly SKIP = new Set(['node_modules', 'dist', '.next', 'build', 'coverage']);
  private static readonly ARTIFACT = /\.(js|js\.map|d\.ts)$/;

  private static walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const name of entries) {
      if (SrcArtifactGuard.SKIP.has(name)) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) SrcArtifactGuard.walk(full, out);
      else if (SrcArtifactGuard.ARTIFACT.test(name) && !SrcArtifactGuard.isAuthored(dir, name)) out.push(full);
    }
    return out;
  }

  /**
   * True for a hand-written ambient declaration — a `.d.ts` with NO same-named `.ts`/`.tsx` beside it.
   *
   * tsc only ever emits `foo.d.ts` from `foo.ts`, so a lone `.d.ts` was authored (e.g. types for a
   * dependency that ships none) and is source, not output.
   */
  private static isAuthored(dir: string, name: string): boolean {
    if (!name.endsWith('.d.ts')) return false;
    const base = name.slice(0, -'.d.ts'.length);
    return !['.ts', '.tsx'].some((ext) => existsSync(path.join(dir, base + ext)));
  }

  /**
   * The directories that hold a package's AUTHORED source.
   *
   * `src` is only the convention for library packages. The two Next apps have no `src` at all — their
   * source is `app`/`components`/`lib`/`hooks`/`service-worker` — so a guard that looks only at `src`
   * watched nothing there, and 16 `*.interface.js`/`.js.map` files sat beside their `.ts` twins in
   * `packages/admin` unnoticed.
   */
  private static readonly SOURCE_ROOTS = ['src', 'app', 'components', 'lib', 'hooks', 'service-worker'];

  /** Every build artifact currently sitting in an authored source directory of any package. */
  static findAll(packagesDir: string): string[] {
    const offenders: string[] = [];
    let packages: string[];
    try { packages = readdirSync(packagesDir); } catch { return offenders; }
    for (const pkg of packages) {
      for (const root of SrcArtifactGuard.SOURCE_ROOTS) {
        const dir = path.join(packagesDir, pkg, root);
        try { if (!statSync(dir).isDirectory()) continue; } catch { continue; }
        offenders.push(...SrcArtifactGuard.walk(dir));
      }
    }
    return offenders;
  }


  /**
   * Artifacts that SHADOW an authored source file — a `.js`/`.mjs` sitting on top of a same-named
   * `.ts`/`.tsx`. This is the strict rule's real harm, isolated so it can be applied to areas that also
   * hold LEGITIMATE bundles.
   *
   * Plugins and themes are exactly that case: `src/ui/bundle.js` and `ui-ssr/entry.mjs` are build products
   * the api serves off disk, and `plugins/<slug>/index.js` is the backend bundle named by `manifest.main`.
   * None of them shadows anything, so the strict "no .js under src" rule would fail the build on ~88 files
   * that are supposed to exist. A shadow is different: it makes the SAME class resolve to two module
   * instances for different importers, which breaks `Enum` reference identity at runtime.
   *
   * `allowRoots` names directories whose bundles are expected (an entry emitted beside its own source).
   */
  static findShadowing(rootDir: string, allowRoots: readonly string[] = []): string[] {
    const offenders: string[] = [];
    let entries: string[];
    try { entries = readdirSync(rootDir); } catch { return offenders; }
    for (const entry of entries) {
      if (SrcArtifactGuard.SKIP.has(entry)) continue;
      const dir = path.join(rootDir, entry);
      try { if (!statSync(dir).isDirectory()) continue; } catch { continue; }
      SrcArtifactGuard.walkShadowing(dir, allowRoots, offenders);
    }
    return offenders;
  }

  private static walkShadowing(dir: string, allowRoots: readonly string[], out: string[]): void {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (SrcArtifactGuard.SKIP.has(name)) continue;
      const full = path.join(dir, name);
      let isDir = false;
      try { isDir = statSync(full).isDirectory(); } catch { continue; }
      if (isDir) { SrcArtifactGuard.walkShadowing(full, allowRoots, out); continue; }
      if (!/\.(js|mjs)$/.test(name)) continue;
      const rel = full.replace(/\\/g, '/');
      if (allowRoots.some((allowed) => rel.includes(allowed))) continue;
      const base = name.replace(/\.(js|mjs)$/, '');
      if (['.ts', '.tsx'].some((ext) => existsSync(path.join(dir, base + ext)))) out.push(full);
    }
  }

  /** The remediation to print when offenders are found. */
  static remedy(): string {
    return [
      'Remove them with:',
      "  find packages/*/{src,app,components,lib,hooks,service-worker} \\( -name '*.js' -o -name '*.js.map' \\) -delete",
      '  # For .d.ts, delete ONLY those with a .ts sibling. An ambient declaration such as',
      '  # react/src/icons/lucide-dynamic-icon-imports.d.ts is AUTHORED and has no sibling — a blanket',
      "  # `-name '*.d.ts' -delete` removes it and the next typecheck fails on the missing module.",
      'Then find the command that emitted them — a positional path passed to tsc (e.g. `tsc packages/core`)',
      'makes it ignore tsconfig.json, so outDir never applies. Build via `typor build` with flags only.',
    ].join('\n');
  }
}
