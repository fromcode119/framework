import { useContext, useMemo } from 'react';
import { PluginContextRegistry } from '../plugin-context';
import { ContextHooksPluginStateService } from './context-hooks-plugin-state-service';
import { ContextHooksSdkService } from './context-hooks-sdk-service';

export class ContextHooks {
  static usePlugins() {
    const context = useContext(PluginContextRegistry.Context);
    if (!context) {
      throw new Error('usePlugins must be used within a PluginsProvider');
    }

    return context;
  }

  static useTranslation() {
    const { t, locale, setLocale } = ContextHooks.usePlugins();
    return { t, locale, setLocale };
  }

  static useAPI() {
    const { api } = ContextHooks.usePlugins();
    return ContextHooksSdkService.useApi(api);
  }

  static useSdk() {
    const { api } = ContextHooks.usePlugins();
    return ContextHooksSdkService.useSdk(api);
  }

  static usePluginsNamespace(namespace: string) {
    const { getPluginApi, hasPluginApi } = ContextHooks.usePlugins() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    return ContextHooksSdkService.usePluginsNamespace(namespace, getPluginApi, hasPluginApi);
  }

  static usePlugin(slug: string) {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getPlugin(slug), [sdk, slug]);
  }

  static useAuth() {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getAuth(), [sdk]);
  }

  static useSystemAuth() {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getSystemAuth(), [sdk]);
  }

  static useSystemAuthSession() {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getSystemAuthSession(), [sdk]);
  }

  static useBrowserState() {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getBrowserState(), [sdk]);
  }

  static useSystem() {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getSystem(), [sdk]);
  }

  static useCollection(collectionSlug: string) {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getCollection(collectionSlug), [collectionSlug, sdk]);
  }

  static useTheme(slug: string) {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getTheme(slug), [sdk, slug]);
  }

  static useSettings() {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getSettings(), [sdk]);
  }

  static usePluginState(pluginSlug: string, key?: string) {
    const { pluginState, setPluginState } = ContextHooks.usePlugins();
    return ContextHooksPluginStateService.usePluginState(pluginState, setPluginState, pluginSlug, key);
  }
}