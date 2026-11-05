import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SourceTree } from '../src/source-tree';
import { WindowGlobalGuard } from '../src/window-global-guard';

const hits = (source: string): string[] => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'window-global-')), 'sample.ts');
  writeFileSync(file, source);
  return WindowGlobalGuard.violationsIn(file);
};

describe('WindowGlobalGuard', () => {
  it('reports writes to window and globalThis, directly and through an alias', () => {
    expect(hits('window.__X__ = 1;')).toHaveLength(1);
    expect(hits('(window as any)[KEY] ||= {};')).toHaveLength(1);
    expect(hits("(((window as any)['k'] ||= {}) as R);")).toHaveLength(1);
    expect(hits('(globalThis as Record<string, unknown>)[k] = v;')).toHaveLength(1);
    expect(hits('Object.defineProperty(globalThis, name, { get });')).toHaveLength(1);
    expect(hits('const w = window as any;\nw.apiUrl = url;')).toHaveLength(1);
  });

  it('leaves reads, comparisons, comments, navigation and Google Tag alone', () => {
    expect(hits('const a = window.location.origin;')).toEqual([]);
    expect(hits('if (window.x === 1) run();')).toEqual([]);
    expect(hits('window.location.href = next;')).toEqual([]);
    expect(hits('// window.x = 1')).toEqual([]);
    expect(hits('window.dataLayer = window.dataLayer || [];')).toEqual([]);
  });

  it('does not mistake a local variable named window for the global', () => {
    expect(hits('const window: Record<string, string> = {};\nwindow[key] = v;')).toEqual([]);
    expect(hits('if (window === 0 || days <= window) status = "ok";\nconst window = 3;')).toEqual([]);
  });

  it('ignores a write that is only text inside a string', () => {
    expect(hits("const html = `<scr` + `ipt>window.onload=()=>window.print()<\\/scr` + `ipt>`;")).toEqual([]);
    expect(hits("const s = 'window.x = 1'; const t = \"globalThis.y = 2\";")).toEqual([]);
    expect(hits("label = 'a'; window.x = 1;")).toHaveLength(1);
  });

  it('scans plugin browser code: ui and ui-ssr are not skipped', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'window-global-ui-'));
    const file = path.join(root, 'ui', 'tracker.ts');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, 'window.fcTracker = {};');
    expect(SourceTree.files(root, (name) => name.endsWith('.ts'), WindowGlobalGuard.SKIP_DIRS)).toEqual([file]);
  });

  it('keys the baseline by the path below packages/', () => {
    expect(WindowGlobalGuard.baselineKey('/x/fw/packages/core/src/page-prefetch.ts')).toBe('core/src/page-prefetch.ts');
  });
});
