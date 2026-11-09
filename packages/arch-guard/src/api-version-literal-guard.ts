import fs from 'node:fs';
import path from 'node:path';
import { GuardScope } from './cli/guard-scope';

/**
 * An api path written with its version by hand: `'/api/v1/system/frontend'`, `` `/api/v1/${slug}` ``.
 *
 * The api has no version segment: every route lives at `/api/...`, `ApiPathUtils` composes each path
 * from `ApiVersionUtils.prefix()`, and `/api/v<N>/...` is not answered at all. A literal with a version
 * written in is therefore a request that 404s.
 *
 * Stylesheets and manifests (`theme.json`, `appearance.json`) are scanned too: a font `url()` or an LCP
 * `urlTemplate` with the version written in it is the same second answer.
 *
 * GATES every tree — the framework and each plugin, theme, appearance and app — so a versioned path
 * cannot come back anywhere.
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
    let found = 0;
    for (const { dir } of GuardScope.areas()) {
      for (const file of ApiVersionLiteralGuard.sources(dir, [])) {
        const lines = ApiVersionLiteralGuard.scan(file);
        if (!lines.length) continue;
        found += lines.length;
        console.log(`  FAIL  ${path.relative(root, file)}:${lines.join(',')}`);
      }
    }
    console.log(`Hand-written versioned api paths: ${found} (must be 0).`);
    if (!found) return 0;
    console.log('The api answers /api/... only. Compose the path with ApiPathUtils (systemPath, authPath, pluginPath, ...) instead.');
    return 1;
  }

  private static sources(dir: string, out: string[]): string[] {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const entry of entries) {
      if (ApiVersionLiteralGuard.SKIP.has(entry.name) && !(entry.name === 'ui' && dir.includes(`${path.sep}src`))) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) ApiVersionLiteralGuard.sources(full, out);
      else if (/\.(tsx?|mjs|cjs|css|less|json)$/.test(entry.name) && !/^(package|package-lock|tsconfig.*)\.json$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }
}
