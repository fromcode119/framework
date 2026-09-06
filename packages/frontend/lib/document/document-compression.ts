import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

/**
 * Content negotiation for the islands document. Next compresses the responses IT renders (pages) but
 * not a route handler's `Response` body — measured: the same home page went over the wire as 109 KB
 * uncompressed from the document route and 33 KB gzipped from the App Router page. The document is
 * the critical resource of the whole page, so it is compressed here, once, synchronously (a ~100 KB
 * string takes single-digit milliseconds): brotli when the client accepts it, else gzip, else identity.
 */
export class DocumentCompression {
  /** Brotli text quality: 5 is the usual "dynamic content" setting — ~90 % of q11's ratio at a fraction of the time. */
  private static readonly BROTLI_QUALITY = 5;

  static encode(html: string, acceptEncoding: string | null | undefined): { body: Uint8Array; encoding: string } {
    const accepts = String(acceptEncoding || '').toLowerCase();
    const bytes = Buffer.from(html, 'utf8');
    if (/\bbr\b/.test(accepts)) {
      return {
        body: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: DocumentCompression.BROTLI_QUALITY, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT, [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length } }),
        encoding: 'br',
      };
    }
    if (/\bgzip\b/.test(accepts)) return { body: gzipSync(bytes), encoding: 'gzip' };
    return { body: bytes, encoding: '' };
  }

  /** The response headers for an encoded body: type, encoding when any, and `Vary` so caches keep the variants apart. */
  static headers(encoding: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8', Vary: 'Accept-Encoding' };
    if (encoding) headers['Content-Encoding'] = encoding;
    return headers;
  }
}
