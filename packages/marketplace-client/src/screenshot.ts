/**
 * A marketplace screenshot, normalised.
 *
 * The wire sends either a bare URL string or `{ url, caption }`; `from()`/`fromAll()` collapse both so
 * consumers only ever read `.url`.
 *
 * Deliberately its OWN copy rather than an import of core's identical class: `marketplace-client` is a
 * standalone client with no dependency on `core`, and importing from there drags core's whole graph
 * (cache, media, …) across the project boundary — `tsc -b` rejects it with rootDir errors.
 */
export class Screenshot {
  private constructor(readonly url: string, readonly caption?: string) {}

  /** Normalise one wire value. A bare string becomes a captionless screenshot. */
  static from(raw: string | { url?: string; caption?: string } | null | undefined): Screenshot {
    if (typeof raw === 'string') return new Screenshot(raw);
    return new Screenshot(String(raw?.url ?? ''), raw?.caption);
  }

  /** Normalise a wire list; a non-array (or absent) value becomes an empty list. */
  static fromAll(raw: unknown): Screenshot[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => Screenshot.from(entry as string | { url?: string; caption?: string }));
  }
}
