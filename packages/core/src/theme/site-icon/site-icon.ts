import { SiteIconChoice } from '@core/theme/site-icon/site-icon-choice';

/**
 * The two icons a site serves — `/favicon.ico` and `/apple-touch-icon.png` — as `/system/frontend`
 * reports them (`siteIcon`). See `SiteIconResolver` for how each is chosen.
 *
 * `themeFavicon` is what an EMPTY Site icon setting resolves to — the active theme's own favicon, or the
 * platform's mark — reported whatever the setting holds, so the admin can name it beside the empty field.
 */
export class SiteIcon {
  constructor(
    readonly favicon: SiteIconChoice,
    readonly appleTouchIcon: SiteIconChoice,
    readonly themeFavicon: SiteIconChoice,
  ) {}

  static from(raw: unknown): SiteIcon {
    const row = (raw ?? {}) as Record<string, unknown>;
    return new SiteIcon(SiteIconChoice.from(row.favicon), SiteIconChoice.from(row.appleTouchIcon), SiteIconChoice.from(row.themeFavicon));
  }
}
