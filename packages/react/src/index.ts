export { FrameworkIcons } from '@react/icons/view/framework-icons.client';
export { FrameworkIconRegistry } from '@react/icons/framework-icon-registry';

export { PluginsProvider } from '@react/context/view/plugins-provider.client';
export { ContextHooks } from '@react/context-hooks/context-hooks';
export { ContextBridge } from '@react/context-bridge';
export { PluginUiRegistrar } from '@react/plugin-ui-registrar';
export type { IPluginUiRegistrarContext } from '@react/interfaces/plugin-ui-registrar-context.interface';
export { RenderableContentTransformerRegistry } from '@react/renderable-content-transformer-registry';
export type { ISlotComponent } from '@react/interfaces/slot-component.interface';
export type { IMenuItem } from '@react/interfaces/menu-item.interface';
export type { ICollectionMetadata } from '@react/interfaces/collection-metadata.interface';
export type { ISecondaryPanelItem } from '@react/interfaces/secondary-panel-item.interface';
export type { ISecondaryPanelContext } from '@react/interfaces/secondary-panel-context.interface';
export type { ISecondaryPanelState } from '@react/interfaces/secondary-panel-state.interface';
export type { IPluginContextValue } from '@react/interfaces/plugin-context-value.interface';
export type { IRenderableContentTransformer } from '@react/interfaces/renderable-content-transformer.interface';
export type { IRenderableContentTransformerMetadata } from '@react/interfaces/renderable-content-transformer-metadata.interface';
// NOTE: `export * from 'lucide-react'` was removed here on purpose. Eagerly
// re-exporting the whole barrel pulled all ~5,730 icons (~171KB gz) into every
// downstream bundle that imports anything from @fromcode119/react — including the
// storefront, which renders a handful of icons. Icons are now resolved lazily:
//   - runtime plugin/theme bundles → `window.Lucide[name]` (LucideNamespaceProxy)
//     and the `lucide-react` import-map entry, both backed by LucideLazyLoader.
//   - framework/admin components → FrameworkIcons.* proxy components.
// Each icon's implementation loads on first render via lucide-react's per-icon
// dynamic-import table; only the name index is eager. No consumer imports a bare
// Lucide icon name from '@fromcode119/react' (verified), so nothing static breaks.
export { Slot } from '@react/slot';
export { AccountShell } from '@react/account-shell';
export { Platform } from '@fromcode119/reactor';
export { AccountShellDefault } from '@react/account/account-shell-default';
export { AccountSectionRegistry } from '@react/account/account-section-registry';
export { AccountSection } from '@react/account/account-section';
export { AccountSectionIcons } from '@react/account/account-section-icons';
export { AccountShellSkeleton } from '@react/account/account-shell-skeleton';
export { AccountShellPlaceholder } from '@react/account/account-shell-placeholder';
export { AccountClass } from '@react/account/account-class';
export { AuthShell } from '@react/auth/auth-shell';
export { Override } from '@react/view/override.client';
export { RecordsHub } from '@react/records-hub';
export type { IRecordsHubItem } from '@react/interfaces/records-hub-item.interface';
export type { IRecordsHubGroup } from '@react/interfaces/records-hub-group.interface';
export type { IRecordsHubResult } from '@react/interfaces/records-hub-result.interface';
export type { IRecordsHubProps } from '@react/interfaces/records-hub-props.interface';
export { RootFramework } from '@react/root-framework';
export { SystemShortcodes } from '@react/system-shortcodes';
export { CollectionQueryUtils } from '@react/collection-queries';
export { BrowserLocalization } from '@react/browser-localization';
export { AsyncDataController } from '@react/async-data-controller';
export { LazyComponentLoaderService } from '@react/lazy-component-loader-service';
export { LazyLoadClass } from '@react/lazy-load-class';
export { PageStyleContext } from '@react/page-style-context';
export { PageStyleProvider } from '@react/page-style-provider';
// Class-consumable contexts (for hook-free framework/admin components via `static contextType`).
export { PluginContextRegistry } from '@react/plugin-context';
export { SettingsContext } from '@react/context/settings-context';
export { TranslationContext } from '@react/context/translation-context';
export { CollectionsContext } from '@react/context/collections-context';
export { MenuContext } from '@react/context/menu-context';
export { PluginStateContext } from '@react/context/plugin-state-context';
// `Slot` and `Override` read these two directly rather than the plugin context, so anything rendering a
// plugin surface OUTSIDE the provider tree — the server pre-render of a page — has to supply them itself.
export { SlotsContext } from '@react/context/slots-context';
export { OverridesContext } from '@react/context/overrides-context';
export { FrontendI18nService } from '@react/context/frontend-i18n-service';
export { PageStyleHooks } from '@react/page-style-hooks';
export type { IPageStyleContextValue } from '@react/interfaces/page-style-context-value.interface';
export { ThemeOverrideRegistrar } from '@react/theme-override-registrar';
// Plugin OOP runtime: hook-free plugin UI components via `static contextType`.
export { PluginRuntimeContext } from '@react/view/plugin-runtime-context.client';
export { PluginRuntimeProvider } from '@react/view/plugin-runtime-provider.client';
export { PluginComponent } from '@react/view/plugin-component.client';
export type { PluginRuntimeValue } from '@react/plugin-runtime-value';

// reactor's OOP surface, re-exported so plugins/themes reach it through the SDK boundary.
export { Reactor, PureReactor, Provider, Bridge, Enum, Context, ReactPrimitives, prop, state, bound, watch, ref } from '@fromcode119/reactor';
// reactor's ref TYPE — type-only, so it needs no runtime shim entry, only a package export.
export type { Ref } from '@fromcode119/reactor';
