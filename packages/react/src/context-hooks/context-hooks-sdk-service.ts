import { useMemo } from 'react';
import { PluginsFacade, SdkClient } from '@fromcode119/core/client';

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

  static usePluginsNamespace(namespace: string, getPluginApi: any, hasPluginApi: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
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
}