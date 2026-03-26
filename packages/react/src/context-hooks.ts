import { useCallback, useContext, useMemo } from 'react';
import { PluginsFacade, SdkClient } from '@fromcode119/core/client';
import { PluginContextRegistry } from './plugin-context';

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

    return useMemo(
      () => ({
        get: (path: string, options?: any) =>
          api.get(`${path.startsWith('/') ? '' : '/'}${path}`, options),
        post: (path: string, body?: any, options?: any) =>
          api.post(`${path.startsWith('/') ? '' : '/'}${path}`, body, options),
        put: (path: string, body?: any, options?: any) =>
          api.put(`${path.startsWith('/') ? '' : '/'}${path}`, body, options),
        delete: (path: string, options?: any) =>
          api.delete(`${path.startsWith('/') ? '' : '/'}${path}`, options),
        patch: (path: string, body?: any, options?: any) =>
          api.patch(`${path.startsWith('/') ? '' : '/'}${path}`, body, options),
      }),
      [api],
    );
  }

  static useSdk() {
    const { api } = ContextHooks.usePlugins();

    return useMemo(() => new SdkClient(api), [api]);
  }

  static usePluginsNamespace(namespace: string) {
    const { getPluginApi, hasPluginApi } = ContextHooks.usePlugins() as any;

    return useMemo(() => {
      const resolver = new PluginsFacade({
        has(targetNamespace: string, slug: string): boolean {
          return hasPluginApi(targetNamespace, slug);
        },
        resolve(targetNamespace: string, slug: string): unknown {
          return getPluginApi(targetNamespace, slug);
        },
      });

      return resolver.namespace(namespace);
    }, [getPluginApi, hasPluginApi, namespace]);
  }

  static usePlugin(slug: string) {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getPlugin(slug), [sdk, slug]);
  }

  /** @deprecated Use ContextHooks.usePlugin() */
  static usePluginAPI(slug: string) {
    return ContextHooks.usePlugin(slug);
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

  /** @deprecated Use ContextHooks.useAuth() */
  static useAuthAPI() {
    return ContextHooks.useAuth();
  }

  static useSystem() {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getSystem(), [sdk]);
  }

  /** @deprecated Use ContextHooks.useSystem() */
  static useSystemAPI() {
    return ContextHooks.useSystem();
  }

  static useCollection(collectionSlug: string) {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getCollection(collectionSlug), [collectionSlug, sdk]);
  }

  /** @deprecated Use ContextHooks.useCollection() */
  static useCollectionAPI(collectionSlug: string) {
    return ContextHooks.useCollection(collectionSlug);
  }

  static useTheme(slug: string) {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getTheme(slug), [sdk, slug]);
  }

  /** @deprecated Use ContextHooks.useTheme() */
  static useThemeAPI(slug: string) {
    return ContextHooks.useTheme(slug);
  }

  static useSettings() {
    const sdk = ContextHooks.useSdk();
    return useMemo(() => sdk.getSettings(), [sdk]);
  }

  static usePluginState(pluginSlug: string, key?: string) {
    const { pluginState, setPluginState } = ContextHooks.usePlugins();
    const state = pluginState[pluginSlug] || {};

    const setter = useCallback(
      (value: any) => {
        if (key) {
          setPluginState(pluginSlug, key, value);
        } else {
          Object.entries(value).forEach(([k, v]) => {
            setPluginState(pluginSlug, k, v);
          });
        }
      },
      [pluginSlug, key, setPluginState],
    );

    if (key) {
      return [state[key], setter] as const;
    }

    return [state, setter] as const;
  }
}
