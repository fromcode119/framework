import fs from 'node:fs';
import path from 'node:path';
import { GuardScope } from './cli/guard-scope';

/**
 * An api path written with its version by hand: `'/api/v1/system/frontend'`, `` `/api/v1/${slug}` ``.
 *
 * The version segment is configuration — `ApiVersionUtils.prefix()` reads it, and `ApiPathUtils`
 * composes every framework path from it — so a literal copy is a second answer that silently stops
 * matching the moment the prefix changes. The api serves `/api/...` and `/api/v1/...` alike, which
 * is exactly why a stale literal would go unnoticed until the alias is retired.
 *
 * GATES the framework. An extension tree is REPORTED only, until each one has moved to its own
 * route-service / client resolver; then it gates too.
 */
export class ApiVersionLiteralGuard {
  private static readonly SKIP = new Set(['node_modules', 'dist', '.next', '.git', 'ui', 'ui-ssr', 'tests', '__tests__', 'coverage', 'arch-guard']);

  /** `api/v<digits>` as a path segment — not part of a longer word or a host name (`api.openai.com/v1`). */
  private static readonly PATTERN = /(?<![\w.-])api\/v\d+(?![\w])/;

  /** Another service's versioned api — an absolute URL whose host is a public domain (`https://uptime.x.com/api/v2/…`). */
  private static readonly THIRD_PARTY = /\w+:\/\/[\w-]+\.[\w.-]+(?::\d+)?\/(?:[^\s'"`]*\/)?api\/v\d+/g;

  static scan(file: string): number[] {
    const lines: number[] = [];
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (ApiVersionLiteralGuard.PATTERN.test(line.replace(ApiVersionLiteralGuard.THIRD_PARTY, ''))) lines.push(index + 1);
    });
    return lines;
  }

  static run(): number {
    const root = process.cwd();
    let gated = 0;
    let reported = 0;
    for (const { area, dir } of GuardScope.areas()) {
      for (const file of ApiVersionLiteralGuard.sources(dir, [])) {
        const lines = ApiVersionLiteralGuard.scan(file);
        if (!lines.length) continue;
        if (area === 'framework') gated += lines.length; else reported += lines.length;
        console.log(`  ${area === 'framework' ? 'FAIL' : 'note'}  ${path.relative(root, file)}:${lines.join(',')}`);
      }
    }
    console.log(`Hand-written versioned api paths: framework ${gated} (must be 0), extensions ${reported} (reported).`);
    if (!gated) return 0;
    console.log('Compose the path with ApiPathUtils (versioned, systemPath, authPath, pluginPath, ...) instead.');
    return 1;
  }

  private static sources(dir: string, out: string[]): string[] {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const entry of entries) {
      if (ApiVersionLiteralGuard.SKIP.has(entry.name) && !(entry.name === 'ui' && dir.includes(`${path.sep}src`))) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) ApiVersionLiteralGuard.sources(full, out);
      else if (/\.(tsx?|mjs|cjs)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }
}
