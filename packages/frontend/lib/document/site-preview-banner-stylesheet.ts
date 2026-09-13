import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The preview banner's own CSS, read from its `.css` file and inlined into the document.
 *
 * INLINED RATHER THAN LINKED, for the same reason `ThemeHeadModel` inlines a theme's stylesheet: a
 * linked sheet arrives after the first paint, and a status bar that appears a moment late shifts the
 * whole page under the reader. It is a few hundred bytes.
 *
 * READ FROM DISK rather than imported, because the two documents this has to appear in are built
 * differently. A Next CSS import compiles into the root layout's chunk, which the App Router links
 * and the islands document only links once there IS a build — so an imported sheet would leave the
 * banner unstyled in development, which is precisely where a site is built and where this is most
 * often seen. Same source file, one copy, both paths.
 *
 * Read once per process, like `FrontendLayoutStylesheets`, and from the same root it assumes.
 */
export class SitePreviewBannerStylesheet {
  private static readonly SOURCE = join('lib', 'document', 'site-preview-banner.css');
  private static cached: string | null = null;

  /** The rules, or '' when the file cannot be read. The banner still renders — unstyled, not absent. */
  static css(): string {
    if (SitePreviewBannerStylesheet.cached === null) SitePreviewBannerStylesheet.cached = SitePreviewBannerStylesheet.read();
    return SitePreviewBannerStylesheet.cached;
  }

  private static read(): string {
    const path = join(process.cwd(), SitePreviewBannerStylesheet.SOURCE);
    if (!existsSync(path)) {
      console.error(`[frontend] preview banner stylesheet not found at ${path}; the banner renders unstyled.`);
      return '';
    }
    try {
      return readFileSync(path, 'utf8');
    } catch (error) {
      console.error('[frontend] preview banner stylesheet unreadable:', error);
      return '';
    }
  }
}
