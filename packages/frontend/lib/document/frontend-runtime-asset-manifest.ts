import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RuntimeAssetConstants } from '@fromcode119/core/client';

/**
 * Where the standalone storefront runtime bundle lives, read from the Vite manifest the runtime build
 * writes next to it (`public/fc-runtime/manifest.json`). Read once per process: the file is build
 * output and does not change while the frontend runs; a rebuild is a new process.
 *
 * Absent manifest (no runtime built) → empty script path, and the document renderer emits no runtime
 * injector: the page still serves, static, and `ssr-status` says why.
 */
export class FrontendRuntimeAssetManifest {
  private static cachedFile: string | null = null;

  /** The public path of the runtime script (`/fc-runtime/runtime-<hash>.js`), or '' when not built. */
  static runtimeScriptPath(): string {
    const file = FrontendRuntimeAssetManifest.runtimeFile();
    return file ? `/${RuntimeAssetConstants.SEGMENT}/${file}` : '';
  }

  /** The content hash in the runtime file name, for status reporting; '' when not built. */
  static runtimeHash(): string {
    const match = /^runtime-([A-Za-z0-9_-]+)\.js$/.exec(FrontendRuntimeAssetManifest.runtimeFile());
    return match ? match[1] : '';
  }

  private static runtimeFile(): string {
    if (FrontendRuntimeAssetManifest.cachedFile === null) {
      FrontendRuntimeAssetManifest.cachedFile = FrontendRuntimeAssetManifest.readRuntimeFile();
    }
    return FrontendRuntimeAssetManifest.cachedFile;
  }

  private static readRuntimeFile(): string {
    const manifestPath = join(process.cwd(), 'public', RuntimeAssetConstants.SEGMENT, 'manifest.json');
    if (!existsSync(manifestPath)) return '';
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, { file?: string; isEntry?: boolean }>;
      const entry = Object.values(manifest).find((chunk) => chunk?.isEntry && chunk.file);
      const file = String(entry?.file || '').trim();
      // Defensive against a hand-edited manifest: the file must be a bare name inside the directory.
      return file && !file.includes('/') && !file.includes('\\') ? file : '';
    } catch (error) {
      console.error('[frontend] runtime manifest unreadable:', error);
      return '';
    }
  }
}
