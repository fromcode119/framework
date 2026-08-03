import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { UseClientPlugin } from './use-client-plugin';

/**
 * Stamps Next's `'use client'` directive into compiled `*.client.js` output.
 *
 * The literal never lives in authored source — the `.client.` FILENAME carries the intent and the
 * directive is added at build time. This covers packages the admin consumes as BUILT output (rather than
 * src-transpiled), where no bundler plugin runs over the sources.
 *
 * Belongs to nextor: it is Next-specific build glue, and `UseClientPlugin` already owns the transform.
 */
export class ClientDirectiveStamper {
  private static walk(dir: string, out: string[]): void {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) ClientDirectiveStamper.walk(full, out);
      else if (/\.client\.js$/.test(name)) out.push(full);
    }
  }

  /** Stamp every `*.client.js` under `distDir`; returns how many changed and how many were seen. */
  static stampDir(distDir: string): { stamped: number; total: number } {
    const files: string[] = [];
    ClientDirectiveStamper.walk(distDir, files);
    let stamped = 0;
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const next = UseClientPlugin.injectInto(src);
      if (next !== src) { writeFileSync(file, next); stamped += 1; }
    }
    return { stamped, total: files.length };
  }
}
