import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The framework's own stylesheets for the storefront document (`app/globals.css`, `auth.css`, the
 * account shell, file share) — under the App Router, Next compiles the root layout's CSS imports into
 * one hashed chunk and links it from the document. The islands document links the SAME chunk: same
 * bytes, same immutable URL, zero duplication. Its name is read once per process from the build's
 * client reference manifest for the home page (the layout's CSS is part of every page's manifest).
 *
 * No build → no stylesheet (the `next dev` server serves the layout's CSS its own way).
 */
export class FrontendLayoutStylesheets {
  private static cached: string[] | null = null;

  /** Public hrefs of the layout's CSS chunks, in manifest order. */
  static hrefs(): string[] {
    if (FrontendLayoutStylesheets.cached === null) FrontendLayoutStylesheets.cached = FrontendLayoutStylesheets.read();
    return FrontendLayoutStylesheets.cached;
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
