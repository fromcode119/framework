import type { SlotComponent } from '../context.interfaces';
import type { TranslationContextValue } from '../context/translation-context.interfaces';

/**
 * One stat card on the framework account-overview dashboard, contributed by a plugin through the
 * `account.overview.stats` slot. The framework renders the descriptor verbatim — label/value/sub are
 * plugin-owned copy (already translated), `sectionKey` is resolved to a link by the framework's
 * account router (`AccountRouteUtils.sectionPath`), and `order` positions the card among ALL
 * contributed cards (lower first), independent of which plugin produced it.
 */
export interface AccountOverviewStat {
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

/**
 * Capabilities handed to a stat contributor's `loadStats` by the overview panel: the cross-plugin
 * namespace facade (so a plugin resolves ITS OWN client), the API client surface, and the active
 * translation function. Contributors never receive framework internals beyond these.
 */
export interface AccountOverviewStatContext {
  namespace: (namespace: string) => any;
  api: any;
  t: TranslationContextValue['t'];
}

/**
 * Contract for a value registered into the `account.overview.stats` slot via
 * `ContextBridge.registerSlotComponent('account.overview.stats', Contributor, '<slug>', priority)`.
 * A contributor is a class (or object) exposing a static `loadStats(context)` that fetches the
 * plugin's own account data and returns stat card descriptors. Return `null` when the plugin API
 * did not respond (auth/namespace still resolving) so the panel retries; return `[]` when it
 * responded but has nothing to show.
 */
export interface AccountOverviewStatContributor {
  accountOverviewStats?: { key: string };
  loadStats(context: AccountOverviewStatContext): Promise<AccountOverviewStat[] | null>;
}

export interface AccountOverviewContentProps {
  contributors: SlotComponent[];
}

export interface AccountOverviewContentState {
  loading: boolean;
  person: Record<string, any> | null;
  stats: AccountOverviewStat[];
}
