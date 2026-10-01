/** How `context.ui.noticeUrl` hands a notice to the storefront. */
export interface IStorefrontNoticeOptions {
  /** `bar` (default) — the site-wide bar; `page` — the destination page shows it as its own content. */
  display?: string;
  /** Seconds the link stays valid. Default 900 (15 min); clamped to 60–86 400. */
  ttlSeconds?: number;
}
