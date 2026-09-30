import path from 'path';

/**
 * Headers for a file the platform serves but did not write: a theme's or plugin's asset, an upload.
 *
 * Those files are served on EVERY host the api answers — the shared admin included — so a document a
 * site put there would run in that host's origin: an `.html` in a site's theme `public/` opened on
 * the admin host runs as whoever opened it, a platform administrator included. A document format is
 * therefore served in an opaque origin (`sandbox`, no scripts) and every file is served as exactly
 * the type its name says (`nosniff`), so nothing else can be made to render as a page.
 *
 * Nothing the platform ships is a document in these directories; its assets are scripts, styles,
 * fonts and images, which a `<script>`/`<link>`/`<img>` loads regardless of these headers.
 */
export class ServedFileHeaderService {
  static readonly DOCUMENT_POLICY = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";

  private static readonly DOCUMENT_EXTENSIONS = new Set(['.html', '.htm', '.shtml', '.xhtml', '.xht', '.xml', '.xsl', '.xslt', '.svg', '.svgz', '.mht', '.mhtml']);

  static isDocument(filePath: string): boolean {
    return ServedFileHeaderService.DOCUMENT_EXTENSIONS.has(path.extname(String(filePath ?? '')).toLowerCase());
  }

  /** The headers for `filePath`. A `.gz` sibling is judged by the file it compresses. */
  static for(filePath: string): Record<string, string> {
    const judged = String(filePath ?? '').replace(/\.gz$/i, '');
    const headers: Record<string, string> = { 'X-Content-Type-Options': 'nosniff' };
    if (ServedFileHeaderService.isDocument(judged)) headers['Content-Security-Policy'] = ServedFileHeaderService.DOCUMENT_POLICY;
    return headers;
  }

  static apply(res: { setHeader(name: string, value: string): unknown }, filePath: string): void {
    for (const [name, value] of Object.entries(ServedFileHeaderService.for(filePath))) res.setHeader(name, value);
  }
}
