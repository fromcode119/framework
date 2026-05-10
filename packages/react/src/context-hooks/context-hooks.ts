import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CollectionsContext } from '../context/collections-context';
import { MenuContext } from '../context/menu-context';
import { PluginStateContext } from '../context/plugin-state-context';
import { SettingsContext } from '../context/settings-context';
import { TranslationContext } from '../context/translation-context';
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
    return useContext(TranslationContext.Context);
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

  static useCollections() {
    return useContext(CollectionsContext.Context);
  }

  static useMenuItems() {
    return useContext(MenuContext.Context);
  }

  static useGlobalSettings() {
    return useContext(SettingsContext.Context);
  }

  static usePluginState(pluginSlug: string, key?: string) {
    const { pluginState, setPluginState } = useContext(PluginStateContext.Context);
    return ContextHooksPluginStateService.usePluginState(pluginState, setPluginState, pluginSlug, key);
  }

  static useCollectionData<T = any>(slug: string): { items: T[]; loading: boolean; error: Error | null } {
    const { api } = ContextHooks.usePlugins();
    const apiRef = useRef(api);
    useEffect(() => { apiRef.current = api; });

    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      apiRef.current.get(`/api/v1/${slug}`)
        .then((data: any) => { if (!cancelled) { setItems(data?.docs ?? []); setLoading(false); } })
        .catch((err: any) => { if (!cancelled) { setError(err instanceof Error ? err : new Error(String(err))); setLoading(false); } });
      return () => { cancelled = true; };
    }, [slug]);

    return { items, loading, error };
  }
}