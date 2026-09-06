import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
// @ts-ignore -- jsdom ships no declaration file in this workspace; the test uses two members of it.
import { JSDOM, VirtualConsole } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { FrontendRuntimeViteConfig } from '@/build/frontend-runtime-vite-config';

/**
 * Guards the built storefront runtime bundle (`npm run build:frontend-runtime`):
 *   - it exists and carries `react-dom/client` (`hydrateRoot`);
 *   - it contains NO server code — the failure mode that killed the previous islands attempt was a
 *     second alias/stub list drifting until the bundle pulled `node-cron`;
 *   - its size is ratcheted against `docs/website-mockup/lighthouse/runtime-size.json`.
 *
 * The bundle is a build ARTIFACT: this suite fails, deliberately, when it has not been built.
 */
class RuntimeBundleFixture {
  static readonly frameworkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  static readonly sizeFile = path.resolve(RuntimeBundleFixture.frameworkRoot, '../../docs/website-mockup/lighthouse/runtime-size.json');
  /** A growth beyond this fraction of the recorded gzip size fails the ratchet. */
  static readonly TOLERANCE = 0.10;
  /**
   * Canary for the Lucide icon SET: the `airplay` icon's path data. It is in the bundle only if an icon
   * implementation table was inlined (a classic IIFE inlines every dynamic import — the +155 KB gzip the
   * first build carried). Icons are served as per-icon data modules under `/fc-runtime/icons/`, so the
   * runtime must carry the icon NAMES (`chevron-down`) and not one icon's drawing.
   */
  static readonly ICON_DATA_CANARY = 'M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1';
  /** Next's App Router invariant — proof that `RouterBridge` (`useRouter`) is NOT in the runtime graph. */
  static readonly NEXT_ROUTER_INVARIANT = /expected app router to be mounted/;
  /** Server-only identifiers that must never appear in a browser bundle. */
  static readonly FORBIDDEN: ReadonlyArray<[string, RegExp]> = [
    ['node-cron', /node-cron/],
    ['express', /\bexpress\b/],
    ['DATABASE_URL', /DATABASE_URL/],
    ['JWT_SECRET', /JWT_SECRET/],
    ['child_process', /\bchild_process\b/],
    ['pg.Pool', /\bpg\.Pool\b/],
  ];

  static get manifestFile(): string {
    return path.join(FrontendRuntimeViteConfig.outDir, 'manifest.json');
  }

  /** The hashed bundle filename, read from the Vite manifest (the same lookup a document renderer does). */
  static get bundleFile(): string {
    const manifest = JSON.parse(readFileSync(RuntimeBundleFixture.manifestFile, 'utf8')) as Record<string, { file: string; isEntry?: boolean }>;
    const entry = Object.values(manifest).find((item) => item.isEntry);
    if (!entry) throw new Error(`no entry in ${RuntimeBundleFixture.manifestFile}`);
    return path.join(FrontendRuntimeViteConfig.outDir, entry.file);
  }

  static get source(): string {
    return readFileSync(RuntimeBundleFixture.bundleFile, 'utf8');
  }

  static get sizes(): { raw: number; gzip: number } {
    const buffer = readFileSync(RuntimeBundleFixture.bundleFile);
    return { raw: buffer.length, gzip: gzipSync(buffer, { level: 9 }).length };
  }

  static readRecorded(): { raw: number; gzip: number } | null {
    if (!existsSync(RuntimeBundleFixture.sizeFile)) return null;
    return JSON.parse(readFileSync(RuntimeBundleFixture.sizeFile, 'utf8')) as { raw: number; gzip: number };
  }

  static record(sizes: { raw: number; gzip: number }): void {
    mkdirSync(path.dirname(RuntimeBundleFixture.sizeFile), { recursive: true });
    const record = { ...sizes, file: path.basename(RuntimeBundleFixture.bundleFile), recordedAt: new Date().toISOString().slice(0, 10) };
    writeFileSync(RuntimeBundleFixture.sizeFile, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  }
}

describe('storefront runtime bundle', () => {
  it('has been built (manifest + hashed IIFE under public/fc-runtime)', () => {
    expect(existsSync(RuntimeBundleFixture.manifestFile), `run \`npm run build:frontend-runtime\` first (${RuntimeBundleFixture.manifestFile})`).toBe(true);
    const file = RuntimeBundleFixture.bundleFile;
    expect(path.basename(file)).toMatch(/^runtime-[A-Za-z0-9_-]+\.js$/);
    expect(existsSync(file)).toBe(true);
  });

  it('is served from a reserved root segment', () => {
    expect(FrontendRuntimeViteConfig.PUBLIC_SEGMENT).toBe('fc-runtime');
  });

  it('carries react-dom/client (hydrateRoot)', () => {
    expect(RuntimeBundleFixture.source).toContain('hydrateRoot');
  });

  it('contains no server code', () => {
    const source = RuntimeBundleFixture.source;
    for (const [label, pattern] of RuntimeBundleFixture.FORBIDDEN) {
      expect(pattern.test(source), `bundle contains server identifier "${label}"`).toBe(false);
    }
  });

  it('carries the icon names but not the icon set', () => {
    const source = RuntimeBundleFixture.source;
    expect(source).toContain('"chevron-down"');
    expect(source.includes(RuntimeBundleFixture.ICON_DATA_CANARY), 'bundle inlines lucide icon implementations').toBe(false);
  });

  it('carries no Next App Router — RouterBridge is not part of the runtime', () => {
    expect(RuntimeBundleFixture.NEXT_ROUTER_INVARIANT.test(RuntimeBundleFixture.source)).toBe(false);
    expect(RuntimeBundleFixture.source.includes('next/dist')).toBe(false);
  });

  it('evaluates in a browser-like document and, after load, boots the pre-boot bridge without errors', async () => {
    const virtualConsole = new VirtualConsole();
    const warnings: string[] = [];
    virtualConsole.on('warn', (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); });
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
    const errors: string[] = [];
    dom.window.addEventListener('error', (event: { message?: string }) => { errors.push(String(event.message || event)); });
    // Module evaluation: the class boots and queues its mount behind `load` (jsdom's document is still
    // `loading` here, exactly like a real document with the script in flight).
    expect(() => dom.window.eval(RuntimeBundleFixture.source)).not.toThrow();
    expect(errors).toEqual([]);

    // The boot itself: `FrontendRuntimeScheduler` flushes one idle slice (jsdom: a 200 ms timer) after
    // `load`, then the entry installs the globals and the PRE-BOOT bridge — the ONE runtime registry,
    // the full bridge object and the import map — before looking for the document's runtime config.
    // This document has none, so the boot says so and stops: nothing is mounted, nothing is fetched.
    dom.window.dispatchEvent(new dom.window.Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    const registry = dom.window.__fromcodeRuntimeModules as Record<string, any> | undefined;
    expect(registry, 'runtime registry was never populated: the entry did not boot').toBeTruthy();
    expect(Object.keys(registry!)).toEqual(expect.arrayContaining(['react', 'react-dom', 'react/jsx-runtime', 'lucide-react', '@fromcode119/react', '@fromcode119/sdk', '@fromcode119/sdk/react']));
    // The registry's `react-dom` module is what the import map hands plugin bundles; React 19 moved the
    // root factories to `react-dom/client`, so the entry must carry them explicitly.
    expect(typeof registry!['react-dom'].createRoot).toBe('function');
    expect(typeof registry!['react-dom'].hydrateRoot).toBe('function');
    // The FULL bridge, not the stub: a theme bundle evaluated against it needs reactor's base classes.
    expect(typeof registry!['@fromcode119/react'].Reactor).toBe('function');
    expect(typeof registry!['@fromcode119/react'].ContextBridge).toBe('function');
    expect(typeof registry!['@fromcode119/react'].ContextBridge.registerTheme).toBe('function');
    expect(typeof registry!['@fromcode119/react'].t).toBe('function');
    expect(dom.window.document.getElementById('fc-runtime-import-map')).toBeTruthy();
    expect(Array.isArray(dom.window._fromcodeQueue)).toBe(true);
    expect(warnings.some((line) => line.includes('no #fc-runtime-config'))).toBe(true);
    // No tolerated error any more: the Next router invariant is gone with RouterBridge.
    expect(errors).toEqual([]);
    dom.window.close();
  });

  it('stays within the size ratchet (docs/website-mockup/lighthouse/runtime-size.json)', () => {
    const sizes = RuntimeBundleFixture.sizes;
    const recorded = RuntimeBundleFixture.readRecorded();
    if (!recorded || sizes.gzip < recorded.gzip) {
      // First run, or the bundle shrank: the ratchet moves DOWN. A deliberate growth is accepted by
      // editing the file by hand — never by the test.
      RuntimeBundleFixture.record(sizes);
      return;
    }
    const limit = Math.round(recorded.gzip * (1 + RuntimeBundleFixture.TOLERANCE));
    expect(sizes.gzip, `runtime bundle grew to ${sizes.gzip} B gzip (raw ${sizes.raw} B); recorded ${recorded.gzip} B, limit ${limit} B`).toBeLessThanOrEqual(limit);
  });
});
