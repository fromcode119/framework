/**
 * A marketplace screenshot, normalised.
 *
 * The wire sends either a bare URL string or `{ url, caption }`, which is why this used to be the
 * `ScreenshotEntry = string | IScreenshot` union — and why three separate admin components each carried
 * their own `typeof s === 'string' ? s : s.url` ternary. Hydrating through `from()`/`fromAll()` at the
 * point the data is read means every consumer just uses `.url`.
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
