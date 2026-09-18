import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FrontendRuntimeAssetManifest } from '@/lib/document/frontend-runtime-asset-manifest';

/**
 * Where the storefront runtime bundle is looked up — and why this is worth a test at all.
 *
 * The lookup resolved `public/fc-runtime/manifest.json` against `process.cwd()`. That is the right
 * answer under `next dev`, which runs from `packages/frontend`, and the wrong one in the built image,
 * where the app starts from the repo root (`app-launcher-main.js --app frontend`, cwd `/app`) and the
 * file sits at `packages/frontend/public/...`.
 *
 * Nothing caught it, and nothing could: a miss is SILENT by design — `runtimeScriptPath()` returns '',
 * the document emits no runtime injector, and the page still serves. Every storefront on the platform
 * rendered header and footer, requested not one plugin bundle, and logged nothing. It reads as a page
 * that simply has no content.
 *
 * So the test is not "does it parse a manifest" but "is it found from BOTH places the app is started
 * from". The cache is per process, so each case reaches in and clears it.
 */
describe('FrontendRuntimeAssetManifest', () => {
  let root = '';
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  /** A manifest in the shape Vite writes, at `<base>/public/fc-runtime/manifest.json`. */
  const writeManifest = (base: string, file: string): void => {
    const dir = path.join(base, 'public', 'fc-runtime');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
      'runtime/frontend-runtime-entry.tsx': { file, name: 'frontend-runtime-entry', isEntry: true },
    }), 'utf8');
  };

  const atCwd = (dir: string): void => {
    (FrontendRuntimeAssetManifest as unknown as { cachedFile: string | null }).cachedFile = null;
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
  };

  beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), 'fc-runtime-manifest-')); });
  afterEach(() => {
    cwdSpy?.mockRestore();
    (FrontendRuntimeAssetManifest as unknown as { cachedFile: string | null }).cachedFile = null;
    rmSync(root, { recursive: true, force: true });
  });

  it('finds it when started from packages/frontend — the `next dev` cwd', () => {
    const frontend = path.join(root, 'packages', 'frontend');
    writeManifest(frontend, 'runtime-DEV12345.js');
    atCwd(frontend);
    expect(FrontendRuntimeAssetManifest.runtimeScriptPath()).toBe('/fc-runtime/runtime-DEV12345.js');
  });

  /** The case that shipped broken: the image starts the app from the repo root. */
  it('finds it when started from the repo root — the built image cwd', () => {
    writeManifest(path.join(root, 'packages', 'frontend'), 'runtime-IMG67890.js');
    atCwd(root);
    expect(FrontendRuntimeAssetManifest.runtimeScriptPath()).toBe('/fc-runtime/runtime-IMG67890.js');
  });

  it('reports the hash from whichever location answered', () => {
    writeManifest(path.join(root, 'packages', 'frontend'), 'runtime-IMG67890.js');
    atCwd(root);
    expect(FrontendRuntimeAssetManifest.runtimeHash()).toBe('IMG67890');
  });

  /**
   * A genuinely absent manifest still has to serve the page — that part of the design is right, and
   * is why the bug was invisible. What it must NOT do any more is stay quiet about it.
   */
  it('returns no path when there is no manifest anywhere, and says so', () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args.map(String).join(' ')); });
    atCwd(root);
    expect(FrontendRuntimeAssetManifest.runtimeScriptPath()).toBe('');
    expect(errors.join('\n')).toContain('no runtime manifest found');
    spy.mockRestore();
  });

  /** Defensive, and kept: a manifest naming a path rather than a bare file is not trusted. */
  it('refuses a manifest entry that escapes the runtime directory', () => {
    const dir = path.join(root, 'public', 'fc-runtime');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
      entry: { file: '../../../etc/passwd', isEntry: true },
    }), 'utf8');
    atCwd(root);
    expect(FrontendRuntimeAssetManifest.runtimeScriptPath()).toBe('');
  });
});
