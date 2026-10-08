import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Every module an SDK entry forwards (`export … from '@fromcode119/core/plugin-server'`) must be a ROOT
 * of the declaration bundle (`tsconfig.declarations.json` → `files`).
 *
 * The bundle emits declarations only for its roots and what they import, then points the SDK's own
 * `dist/*.d.ts` at that tree. `core/plugin-server` was no root and nothing else imported it, so
 * `dist/server.d.ts` — `BasePluginRouter`, `BaseController`, `Logger`, everything a plugin's backend
 * imports — pointed at files that were never written. `skipLibCheck` hid it inside the `.d.ts`; a
 * plugin saw only "Property 'get' does not exist on type 'MyRouter'". A forwarded module that happens to
 * be emitted because some other root imports it today is the same bug waiting for that import to go.
 */
describe('SDK declaration bundle roots', () => {
  const sdkRoot = path.resolve(__dirname, '..');
  const frameworkRoot = path.resolve(sdkRoot, '../..');
  const config = JSON.parse(fs.readFileSync(path.join(sdkRoot, 'tsconfig.declarations.json'), 'utf8')
    .split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n').replace(/,(\s*[}\]])/g, '$1'));
  const roots = new Set<string>((config.files as string[]).map((file) => path.resolve(sdkRoot, file)));
  const paths = config.compilerOptions.paths as Record<string, string[]>;

  const sources = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? sources(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
  });

  /** The source file a package specifier means under the bundle's own `paths`, as the bundle compiles it. */
  const resolve = (specifier: string): string | null => {
    const exact = paths[specifier]?.[0];
    const wildcard = Object.entries(paths).find(([key]) => key.endsWith('/*') && specifier.startsWith(key.slice(0, -1)));
    const target = exact ?? wildcard?.[1][0].replace('*', specifier.slice(wildcard[0].length - 1));
    if (!target) return null;
    const base = path.resolve(frameworkRoot, target);
    return [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) ?? null;
  };

  const forwarded = [...new Set(sources(path.join(sdkRoot, 'src'))
    .flatMap((file) => [...fs.readFileSync(file, 'utf8').matchAll(/from '(@fromcode119\/[^']+)'/g)].map((match) => match[1]))
    .filter((specifier) => !specifier.startsWith('@fromcode119/sdk')))].sort();

  it('makes every module an SDK entry forwards a root of the declaration bundle', () => {
    expect(forwarded.length).toBeGreaterThan(0);
    const missing = forwarded.filter((specifier) => {
      const file = resolve(specifier);
      return !file || !roots.has(file);
    });
    expect(missing, 'add each to `files` in packages/sdk/tsconfig.declarations.json').toEqual([]);
  });

  it('leaves no entry of the built SDK pointing at a declaration that was never emitted', () => {
    const dist = path.join(sdkRoot, 'dist');
    if (!fs.existsSync(dist)) return;
    const entries = sources(dist).filter((file) => file.endsWith('.d.ts') && !file.includes(`${path.sep}_types${path.sep}`));
    const dangling = entries.flatMap((file) => [...fs.readFileSync(file, 'utf8').matchAll(/from '(\.[^']+)'/g)]
      .map((match) => match[1])
      .filter((specifier) => {
        const base = path.resolve(path.dirname(file), specifier);
        return ![`${base}.d.ts`, path.join(base, 'index.d.ts')].some((candidate) => fs.existsSync(candidate));
      })
      .map((specifier) => `${path.relative(dist, file)} -> ${specifier}`));
    expect([...new Set(dangling)]).toEqual([]);
  });
});
