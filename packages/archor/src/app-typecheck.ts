import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TyporSyntaxPlugin } from '@fromcode119/typor/build';

/**
 * Real `tsc --noEmit` over the Next apps (admin, frontend).
 *
 * Both apps set `typescript.ignoreBuildErrors`, so a green `next build` proves only that the bundle
 * resolves — it does not type-check. This is the gate that actually does, and it has caught shipped bugs
 * (an `Enum` compared to a raw string is always false; an `import type` of a runtime value throws).
 *
 * typor owns it because the source uses typor's extended syntax, which `tsc` cannot parse: the affected
 * files are rewritten in place for the duration of the check and always restored.
 */
export class AppTypecheck {
  private static readonly SKIP = new Set(['node_modules', '.next', 'dist']);

  private static walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const name of entries) {
      if (AppTypecheck.SKIP.has(name)) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) AppTypecheck.walk(full, out);
      else if (/\.(ts|tsx)$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
    }
    return out;
  }

  /**
   * Rewrite typor's extended syntax in place across `packagesDir`, returning the restore function.
   * The caller MUST invoke it in a `finally` (and on exit) so source is never left transformed.
   */
  static applyExtendedSyntax(packagesDir: string): () => void {
    const originals = new Map<string, string>();
    for (const file of AppTypecheck.walk(packagesDir)) {
      const source = readFileSync(file, 'utf8');
      if (!TyporSyntaxPlugin.handles(source)) continue;
      originals.set(file, source);
      writeFileSync(file, TyporSyntaxPlugin.transform(source), 'utf8');
    }
    return () => {
      for (const [file, source] of originals) writeFileSync(file, source, 'utf8');
      originals.clear();
    };
  }

  /**
   * Type errors for one app, excluding generated `.next/**` types and test files — those are not the
   * app's authored surface and would make the ratchet meaningless.
   */
  static countErrors(framework: string, project: string): number {
    let output = '';
    try {
      execFileSync(path.join(framework, 'node_modules/.bin/tsc'), ['--noEmit', '-p', project],
        { encoding: 'utf8', cwd: framework });
    } catch (err) {
      output = String((err as { stdout?: string }).stdout ?? '');
    }
    return output.split('\n')
      .filter((line) => / error TS\d+/.test(line))
      .filter((line) => !/[/\\]\.next[/\\]/.test(line) && !/\.test\.[cm]?tsx?/.test(line))
      .length;
  }
}
