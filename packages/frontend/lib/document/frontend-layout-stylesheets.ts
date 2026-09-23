import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The framework's own stylesheets for the storefront document (`app/globals.css`, `auth.css`, the
 * account shell, file share) — under the App Router, Next compiles the root layout's CSS imports into
 * one hashed chunk and links it from the document. The islands document links the SAME chunk: same
 * bytes, same immutable URL, zero duplication. Its name is read once per process from the build's
 * client reference manifest for the home page (the layout's CSS is part of every page's manifest).
 *
 * THE HREF ONLY RESOLVES UNDER `next start`. A dev server serves `/_next/static/*` from its own
 * pipeline and will not hand out a chunk left behind by an earlier production build — and this
 * image ships a built `.next` and then runs `next dev` on top of it, so the manifest was present,
 * the chunk was present on disk, and the URL 404'd. The document therefore linked a stylesheet that
 * never loaded: no `html, body { margin: 0 }`, so the browser's default 8px body margin framed
 * EVERY storefront page of EVERY theme in a white border, locally only. Production was fine, which
 * is what made it survive — the bug was invisible to the one build that serves the chunk.
 *
 * So the manifest existing is NOT the question; whether this process serves that URL is. In
 * development the same bytes are INLINED instead, which is what the document already does with the
 * theme's own CSS, so local renders what production renders.
 */
export class FrontendLayoutStylesheets {
  private static cachedHrefs: string[] | null = null;
  private static cachedCss: string | null = null;

  /** True when this process serves hashed `/_next/static` chunks — i.e. `next start`, not `next dev`. */
  private static servesBuiltChunks(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /** Public hrefs of the layout's CSS chunks, in manifest order. Empty in development. */
  static hrefs(): string[] {
    if (!FrontendLayoutStylesheets.servesBuiltChunks()) return [];
    if (FrontendLayoutStylesheets.cachedHrefs === null) FrontendLayoutStylesheets.cachedHrefs = FrontendLayoutStylesheets.read();
    return FrontendLayoutStylesheets.cachedHrefs;
  }

  /**
   * The same CSS as `hrefs()`, as text, for the document to inline — development only, where the
   * href would 404. Empty in production and whenever the build's chunks are not on disk.
   */
  static inlineCss(): string {
    if (FrontendLayoutStylesheets.servesBuiltChunks()) return '';
    if (FrontendLayoutStylesheets.cachedCss === null) FrontendLayoutStylesheets.cachedCss = FrontendLayoutStylesheets.readCss();
    return FrontendLayoutStylesheets.cachedCss;
  }

  private static chunkPaths(): string[] {
    return FrontendLayoutStylesheets.read().map((href) => join(process.cwd(), '.next', href.replace(/^\/_next\//, '')));
  }

  private static readCss(): string {
    const parts: string[] = [];
    for (const file of FrontendLayoutStylesheets.chunkPaths()) {
      if (!existsSync(file)) continue;
      try {
        parts.push(readFileSync(file, 'utf8'));
      } catch (error) {
        console.error('[frontend] layout stylesheet unreadable:', error);
      }
    }
    return parts.join('\n');
  }

  private static read(): string[] {
    const manifest = join(process.cwd(), '.next', 'server', 'app', 'page_client-reference-manifest.js');
    if (!existsSync(manifest)) return [];
    try {
      const source = readFileSync(manifest, 'utf8');
      const files = new Set<string>();
      for (const match of source.matchAll(/"(static\/chunks\/[A-Za-z0-9_.-]+\.css)"/g)) files.add(`/_next/${match[1]}`);
      return [...files];
    } catch (error) {
      console.error('[frontend] layout stylesheet manifest unreadable:', error);
      return [];
    }
  }
}
