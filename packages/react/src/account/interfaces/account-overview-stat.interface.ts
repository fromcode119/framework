/**
 * One stat card on the framework account-overview dashboard, contributed by a plugin through the
 * `account.overview.stats` slot. The framework renders the descriptor verbatim — label/value/sub are
 * plugin-owned copy (already translated), `sectionKey` is resolved to a link by the framework's
 * account router (`AccountRouteUtils.sectionPath`), and `order` positions the card among ALL
 * contributed cards (lower first), independent of which plugin produced it.
 */
export interface IAccountOverviewStat {
  key: string;
  order: number;
  label: string;
  value: string;
  sub?: string;
  /** Account section this card links to (e.g. 'orders'); resolved via AccountRouteUtils.sectionPath. */
  sectionKey?: string;
  /** Optional explicit href — overrides sectionKey resolution when present. */
  href?: string;
  accent?: string;
}
