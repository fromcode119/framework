import type { MarketplacePluginCardProps } from './marketplace-card.interfaces';

export type MarketplaceCardActionsProps = Pick<
  MarketplacePluginCardProps,
  'plugin' | 'theme' | 'installed' | 'installedVersion' | 'hasUpdate' | 'installing' | 'onOpenInstalled' | 'onInstall'
>;
