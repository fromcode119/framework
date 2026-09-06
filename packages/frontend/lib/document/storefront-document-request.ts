/**
 * What the document renderer needs from an incoming request: the path segments after the `/fc-document`
 * rewrite prefix, the path the visitor actually typed (for `?next=` on the account gate), and the query
 * in the same shape the App Router hands pages (`searchParams`).
 */
export class StorefrontDocumentRequest {
  private constructor(
    readonly segments: string[],
    readonly pathname: string,
    readonly searchParams: Record<string, string | string[] | undefined>,
    readonly acceptEncoding: string,
  ) {}

  static from(segments: string[] | undefined, url: URL, acceptEncoding = ''): StorefrontDocumentRequest {
    const clean = (segments || []).map((part) => String(part || '').trim()).filter(Boolean);
    const searchParams: Record<string, string | string[]> = {};
    for (const key of new Set(url.searchParams.keys())) {
      const values = url.searchParams.getAll(key);
      searchParams[key] = values.length > 1 ? values : values[0];
    }
    return new StorefrontDocumentRequest(clean, `/${clean.join('/')}`, searchParams, String(acceptEncoding || ''));
  }
}
