import { SiteIconSource } from '@core/enums/site-icon-source.enum';

/**
 * One icon a site serves: where it comes from, the path the storefront fetches it from (on the api,
 * relative to its base), and — for a theme file — the file's name, so the admin can say which one.
 *
 * Built by `SiteIconResolver` on the api; read back from the `/system/frontend` payload with `from`.
 * A PLATFORM choice has no path: the storefront serves its own mark.
 */
export class SiteIconChoice {
  constructor(
    readonly source: SiteIconSource,
    readonly path: string,
    readonly file: string,
  ) {}

  static readonly PLATFORM = new SiteIconChoice(SiteIconSource.PLATFORM, '', '');

  static from(raw: unknown): SiteIconChoice {
    const row = (raw ?? {}) as Record<string, unknown>;
    const path = String(row.path ?? '').trim();
    if (!path) return SiteIconChoice.PLATFORM;
    return new SiteIconChoice(SiteIconSource.resolve(row.source), path, String(row.file ?? '').trim());
  }

  get isPlatform(): boolean {
    return this.source === SiteIconSource.PLATFORM;
  }

  /** The payload form: the source crosses as its string value. */
  toJSON(): Record<string, string> {
    return { source: String(this.source.value), path: this.path, file: this.file };
  }
}
