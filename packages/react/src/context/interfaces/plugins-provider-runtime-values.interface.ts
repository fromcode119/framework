import type { ICollectionMetadata } from '@react/interfaces/collection-metadata.interface';
import type { IMenuItem } from '@react/interfaces/menu-item.interface';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';

/**
 * What `PluginsProviderInternal.read()` hands to `present()` — only the values the provider TREE
 * publishes, not the two dozen state slices behind them.
 *
 * A structural contract between the two halves of one Bridge, so it stays an `interface`.
 */
export interface IPluginsProviderRuntimeValues {
  slots: Record<string, ISlotComponent[]>;
  overrides: Record<string, ISlotComponent>;
  collections: ICollectionMetadata[];
  menuItems: IMenuItem[];
  settings: Record<string, unknown>;
  /** `{ t, locale, setLocale }`, memoised in `read()`. */
  translationValue: unknown;
  /** `{ pluginState, setPluginState }`, memoised in `read()`. */
  pluginStateValue: unknown;
  /** The full plugin-context value published to `PluginContextRegistry`. */
  value: unknown;
}
