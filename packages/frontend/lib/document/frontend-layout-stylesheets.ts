import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The framework's own stylesheets for the storefront document (`app/globals.css`, `auth.css`, the
 * account shell, file share). Under the App Router, Next compiles the root layout's CSS imports into
 * one hashed chunk; its name is read once per process from the build's client reference manifest for
 * the home page (the layout's CSS is part of every page's manifest), and its bytes from disk.
 *
 * The islands document INLINES those bytes, as it already does with the theme's own CSS, rather than
 * linking the chunk:
 *
 *  - A `<link>` is render-blocking. It was the only blocking request left on a storefront page, and
 *    the largest text on the page could not paint until it arrived: most of a mobile LCP was waiting
 *    on 16 KB of baseline rules.
 *  - The href only resolves under `next start`. A dev server serves `/_next/static/*` from its own
 *    pipeline and will not hand out a chunk left behind by an earlier production build, so the linked
 *    stylesheet 404'd locally: no `html, body { margin: 0 }`, and every storefront page of every
 *    theme sat in a white 8px frame, locally only. Inlining serves both from the same bytes.
 */
export class FrontendLayoutStylesheets {
  private static cachedCss: string | null = null;

  /** The layout's CSS, in manifest order, for the document to inline. Empty when the build's chunks are not on disk. */
  static inlineCss(): string {
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
