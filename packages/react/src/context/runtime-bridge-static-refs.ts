import React from 'react';
import ReactDOM from 'react-dom';
// reactor is the OOP base layer; plugins may only import @fromcode119/sdk, so its surface is
// republished through this bridge. Imported statically — a require() here is interop-shimmed by
// Turbopack in the browser bundle and broke module evaluation.
import { Reactor, PureReactor, Provider, Bridge, Enum, Context, ReactPrimitives, Platform, prop, state, bound, watch, ref } from '@fromcode119/react-class-components';
import { ApiVersionUtils, CoercionUtils, CollectionUtils, FormatUtils, HookEventUtils, LocalizationUtils, NumberUtils, PaginationUtils, RelationUtils, RuntimeConstants, StringUtils } from '@fromcode119/core/client';
import { AuthMode } from '@react/auth/enums/auth-mode.enum';
import { BrowserLocalization } from '@react/browser-localization';
import { CollectionQueryUtils } from '@react/collection-queries';
import { FrameworkIconRegistry } from '@react/icons/framework-icon-registry';
import { FrameworkIcons } from '@react/icons/view/framework-icons.client';
import { AccountShell } from '@react/account-shell';
import { AuthShell } from '@react/auth/auth-shell';
import { RecordsHub } from '@react/records-hub';
import { TokenEmailPreferencesPanel } from '@react/account/token-email-preferences-panel.client';
import { AccountShellPlaceholder } from '@react/account/account-shell-placeholder';
import { AccountShellSkeleton } from '@react/account/account-shell-skeleton';
import { AccountShellDefault } from '@react/account/account-shell-default';
import { AccountSectionRegistry } from '@react/account/account-section-registry';
import { AccountSection } from '@react/account/account-section';
import { AccountSectionIcons } from '@react/account/account-section-icons';
import { AccountClass } from '@react/account/account-class';
import { SlotsContext } from '@react/context/slots-context';
import { RootFramework } from '@react/root-framework';
import { SystemShortcodes } from '@react/system-shortcodes';
import { ContextBridgeHooks } from '@react/context/context-bridge-hooks';
import { Slot } from '@react/slot';
import { Override } from '@react/view/override.client';
import type { IRuntimeBridgeInstallArgs } from '@react/interfaces/runtime-bridge-install-args.interface';

/**
 * The part of the bridge that does not depend on a mounted provider: SDK utilities, reactor's OOP
 * surface, the icon registry, the framework shells, React itself.
 *
 * ONE builder for two installs. The live install (`useRuntimeBridgeInstall`, from the provider's effect)
 * spreads this under the provider's closures; the PRE-BOOT install (the islands runtime, before any
 * provider exists) spreads it under queueing stand-ins. Because both hand bundles the SAME references —
 * above all the same shell classes with the same memoised `React.lazy` implementations — a component a
 * theme rendered against the pre-boot bridge is the same component type after the live install, and
 * React keeps it mounted.
 */
export class RuntimeBridgeStaticRefs {
  /**
   * The code-split implementations, memoised per shell.
   *
   * Memoised because the bridge is reinstalled whenever its dependencies change, and a fresh
   * `React.lazy` on every install is a NEW component type — React would unmount and remount whatever a
   * theme had rendered with the previous one, which for `/account` means losing the panel's state.
   */
  private static readonly lazyImplementations = new Map<string, React.ComponentType<any>>();

  private static lazyImplementation(key: string, loader: () => Promise<{ default: React.ComponentType<any> }>): React.ComponentType<any> {
    const cached = RuntimeBridgeStaticRefs.lazyImplementations.get(key);
    if (cached) return cached;
    const Lazy = React.lazy(loader);
    RuntimeBridgeStaticRefs.lazyImplementations.set(key, Lazy);
    return Lazy;
  }

  /**
   * The route-level shells, with their implementations code-split. LAZY on purpose: they are only ever
   * rendered by a theme layout (`/account`, `/login`, `/unsubscribe`), and as static imports ~400 KB of
   * account/auth/records UI would be parsed on a product page that renders none of it.
   *
   * The bridge hands out the shell CLASSES themselves — each is its own Suspense boundary
   * (`ShellBoundary`), with the fallback that has the shell's shape — and swaps the implementation
   * each boundary renders for a `React.lazy` of its module. The server renders the same classes around
   * the static implementations, so `hydrateRoot` finds the same boundary on both sides and the lazy
   * chunk hydrates INTO the server's markup. Same memoised lazy across installs → same component type.
   */
  static shells(): Pick<IRuntimeBridgeInstallArgs, 'AccountShell' | 'AuthShell' | 'RecordsHub' | 'TokenEmailPreferencesPanel'> {
    AccountShell.implementation.replace(RuntimeBridgeStaticRefs.lazyImplementation(
      'account-shell',
      () => import('@react/account/account-shell-implementation').then((m) => ({ default: m.AccountShellImplementation })),
    ));
    AuthShell.implementation.replace(RuntimeBridgeStaticRefs.lazyImplementation(
      'auth-shell',
      () => import('@react/auth/auth-shell-implementation').then((m) => ({ default: m.AuthShellImplementation })),
    ));
    RecordsHub.implementation.replace(RuntimeBridgeStaticRefs.lazyImplementation(
      'records-hub',
      () => import('@react/records-hub-implementation').then((m) => ({ default: m.RecordsHubImplementation })),
    ));
    TokenEmailPreferencesPanel.implementation.replace(RuntimeBridgeStaticRefs.lazyImplementation(
      'token-email-preferences-panel',
      () => import('@react/account/token-email-preferences-panel-implementation.client').then((m) => ({ default: m.TokenEmailPreferencesPanelImplementation })),
    ));
    return { AccountShell, AuthShell, RecordsHub, TokenEmailPreferencesPanel };
  }

  /** Everything on the install args that is a static reference. */
  static build(): Omit<IRuntimeBridgeInstallArgs,
    | 'apiUrl' | 'registerContentTransformer' | 'registerSlotComponent' | 'registerFieldComponent' | 'registerOverride'
    | 'registerMenuItem' | 'replaceMenuItems' | 'registerCollection' | 'replaceCollections' | 'registerPlugins'
    | 'registerTheme' | 'registerSettings' | 'registerTranslations' | 'registerPluginApi' | 'getPluginApi'
    | 'hasPluginApi' | 'setPluginState' | 'stableLoadConfig' | 'stableGetFrontendMetadata' | 'emit' | 'on'
    | 'stableT' | 'stableApiBridge' | 'setLocale' | 'isReady' | 'PluginsProvider' | 'runtimeModules' | 'stabilityRef'
  > {
    return {
      ...RuntimeBridgeStaticRefs.shells(),
      usePlugins: ContextBridgeHooks.usePluginsBridgeHook,
      useTranslation: ContextBridgeHooks.useTranslationBridgeHook,
      usePluginState: ContextBridgeHooks.usePluginStateBridgeHook,
      useSystemShortcodes: SystemShortcodes.useSystemShortcodes,
      CollectionQueryUtils,
      BrowserLocalization,
      LocalizationUtils,
      RelationUtils,
      CoercionUtils,
      StringUtils,
      NumberUtils,
      FormatUtils,
      ApiVersionUtils,
      CollectionUtils,
      PaginationUtils,
      HookEventUtils,
      RuntimeConstants,
      getIcon: (name: string) => FrameworkIcons.getIcon(name),
      FrameworkIconRegistry,
      FrameworkIcons,
      IconNames: FrameworkIcons.iconNames(),
      createProxyIcon: (name: string) => FrameworkIcons.createProxyIcon(name),
      RootFramework,
      Slot,
      Override,
      AccountShellSkeleton,
      AccountShellPlaceholder,
      SlotsContext,
      Platform,
      AccountShellDefault,
      AccountSectionRegistry,
      AccountSection,
      AccountSectionIcons,
      AccountClass,
      AuthMode,
      ReactPrimitives,
      Reactor,
      PureReactor,
      Provider,
      Bridge,
      Enum,
      Context,
      prop,
      state,
      bound,
      watch,
      ref,
      ReactRef: React,
      ReactDOMRef: ReactDOM,
    };
  }
}
