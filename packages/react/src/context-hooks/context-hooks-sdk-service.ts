import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { PluginsFacade, SdkClient } from '@fromcode119/core/client';
import type { PluginApiSubscription } from '../context.interfaces';

export class ContextHooksSdkService {
  static useApi(api: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return useMemo(
      () => ({
        get: (path: string, options?: any) => api.get(`${path.startsWith('/') ? '' : '/'}${path}`, options), // eslint-disable-line @typescript-eslint/no-explicit-any
        post: (path: string, body?: any, options?: any) => api.post(`${path.startsWith('/') ? '' : '/'}${path}`, body, options), // eslint-disable-line @typescript-eslint/no-explicit-any
        put: (path: string, body?: any, options?: any) => api.put(`${path.startsWith('/') ? '' : '/'}${path}`, body, options), // eslint-disable-line @typescript-eslint/no-explicit-any
        delete: (path: string, options?: any) => api.delete(`${path.startsWith('/') ? '' : '/'}${path}`, options), // eslint-disable-line @typescript-eslint/no-explicit-any
        patch: (path: string, body?: any, options?: any) => api.patch(`${path.startsWith('/') ? '' : '/'}${path}`, body, options), // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
      [api],
    );
  }

  static useSdk(api: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return useMemo(() => new SdkClient(api), [api]);
  }

  static usePluginsNamespace(
    namespace: string,
    getPluginApi: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    hasPluginApi: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    subscription?: PluginApiSubscription,
  ) {
    // Subscribe to the plugin API registry so late registrations (plugin frontend bundles
    // registering their API clients after this component rendered) propagate here in ONE
    // coalesced re-render per batch — instead of only being "discovered" on unrelated
    // provider re-renders. Registrations are client-only, so the server snapshot is 0 and
    // SSR/hydration stay consistent.
    // Tracks the registry version this component last RENDERED with. `useSyncExternalStore`
    // records its own snapshot in a deferred passive effect, so a notification landing between
    // commit and that effect would force a redundant re-render; pre-filtering against the
    // rendered version makes the dedupe race-free. Never suppresses a real change (versions are
    // monotonic), and uSES's own commit-time consistency check remains as the safety net.
    const renderedVersionRef = useRef(0);
    const subscribe = useCallback(
      (listener: () => void) => (
        subscription
          ? subscription.subscribe(() => {
            if (subscription.getSnapshot() !== renderedVersionRef.current) {
              listener();
            }
          })
          : () => {}
      ),
      [subscription],
    );
    const getSnapshot = useCallback(() => (subscription ? subscription.getSnapshot() : 0), [subscription]);
    const getServerSnapshot = useCallback(() => (subscription ? subscription.getServerSnapshot() : 0), [subscription]);
    const registryVersion = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    renderedVersionRef.current = registryVersion;

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
      // registryVersion re-derives the facade when the registry contents change.
    }, [getPluginApi, hasPluginApi, namespace, registryVersion]);
  }
}
