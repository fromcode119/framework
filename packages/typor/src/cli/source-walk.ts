import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** Every authored `.ts`/`.tsx` under a directory, skipping build output and dependencies. */
export class SourceWalk {
  static files(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const name of entries) {
      if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) SourceWalk.files(full, out);
      else if (/\.(ts|tsx)$/.test(full) && !full.endsWith('.d.ts')) out.push(full);
    }
    return out;
  }
}
