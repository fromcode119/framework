import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PluginBackendTypecheck } from '../src/plugin-backend-typecheck';

const FRAMEWORK = path.resolve(__dirname, '../../..');

/** A throwaway plugin: `files` maps a path under the plugin root to its source. */
function plugin(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'backend-types-'));
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), source, 'utf8');
  }
  return root;
}

describe('plugin-backend-types', () => {
  const made: string[] = [];
  const make = (files: Record<string, string>) => {
    const root = plugin(files);
    made.push(root);
    return root;
  };
  afterEach(() => { for (const root of made.splice(0)) rmSync(root, { recursive: true, force: true }); });

  it('checks the entry and src/, never the admin UI, tests or installed packages', () => {
    const root = make({
      'index.ts': 'export {};', 'src/service.ts': 'export {};', 'src/nested/ui/kept.ts': 'export {};',
      'src/ui/page.tsx': '', 'src/ui/client.ts': '', 'src/service.test.ts': '', 'tests/a.ts': '', 'src/node_modules/x/index.ts': '', 'src/types.d.ts': '',
    });
    const files = (PluginBackendTypecheck as any).sources(root).map((file: string) => path.relative(root, file)).sort();
    expect(files).toEqual(['index.ts', path.join('src', 'nested', 'ui', 'kept.ts'), path.join('src', 'service.ts')]);
  });

  it('only counts a directory with a backend entry as a plugin', () => {
    const root = make({ 'with/index.ts': 'export {};', 'without/README.md': '' });
    expect(PluginBackendTypecheck.pluginDirs(root).map((dir) => path.basename(dir))).toEqual(['with']);
  });

  it('reports an import of a package the plugin does not declare — the runtime has only its own', () => {
    const root = make({ 'index.ts': "import PDFDocument from 'pdfkit';\nexport const doc = PDFDocument;\n" });
    expect(PluginBackendTypecheck.report(FRAMEWORK, root).join('\n')).toMatch(/TS2307: Cannot find module 'pdfkit'/);
  });

  it('narrows a result union the way the backends write it, and passes clean code', () => {
    const root = make({
      'index.ts': "import { readFileSync } from 'node:fs';\nimport { settle } from '@plugin/src/settle';\nexport const read = () => readFileSync('x');\nexport const message = () => { const result = settle(); return result.ok ? result.settled : result.error; };\n",
      'src/settle.ts': "export const settle = (): { ok: true; settled: number } | { ok: false; error: string } => ({ ok: true, settled: 1 });\n",
    });
    expect(PluginBackendTypecheck.report(FRAMEWORK, root)).toEqual([]);
  });

  it('reports a call to something that does not exist', () => {
    const root = make({ 'index.ts': "import { settle } from '@plugin/src/settle';\nexport const go = () => settle().missing();\n", 'src/settle.ts': 'export const settle = () => ({ done: true });\n' });
    expect(PluginBackendTypecheck.report(FRAMEWORK, root).join('\n')).toMatch(/TS2339: Property 'missing' does not exist/);
  });
});
