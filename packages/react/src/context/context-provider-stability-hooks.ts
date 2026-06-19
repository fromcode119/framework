import React from 'react';
import { ContextProviderStateService } from './context-provider-state-service';

export class ContextProviderStabilityHooks {
  static useStabilitySnapshot(args: {
    stabilityRef: React.MutableRefObject<any>;
    snapshot: Record<string, any>;
  }) {
    const { stabilityRef, snapshot } = args;
    // setLocale is a referentially-stable useState setter, so deriving deps from the snapshot
    // values (which include it) is equivalent to the original explicit dep list.
    const deps = Object.values(snapshot);

    React.useEffect(() => {
      stabilityRef.current = snapshot;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
  }

  static useStableHandles(args: { stabilityRef: React.MutableRefObject<any> }) {
    const { stabilityRef } = args;

    const stableT = React.useCallback((...handleArgs: any[]) => (stabilityRef.current.t as any)(...handleArgs), [stabilityRef]);
    const stableLoadConfig = React.useCallback((path?: string) => {
      const resolvedPath = (typeof path === 'string' && path.trim()) ? path.trim() : ContextProviderStateService.getFrontendConfigPath();
      return (stabilityRef.current.loadConfig as any)(resolvedPath);
    }, [stabilityRef]);
    const stableGetFrontendMetadata = React.useCallback((...handleArgs: any[]) => (stabilityRef.current.getFrontendMetadata as any)(...handleArgs), [stabilityRef]);
    const stableApiBridge = React.useMemo(() => ({
      getBaseUrl: () => (stabilityRef.current.api as any).getBaseUrl(),
      get: (path: string, options?: any) => (stabilityRef.current.api as any).get(path, options),
      post: (path: string, body?: any, options?: any) => (stabilityRef.current.api as any).post(path, body, options),
      put: (path: string, body?: any, options?: any) => (stabilityRef.current.api as any).put(path, body, options),
      patch: (path: string, body?: any, options?: any) => (stabilityRef.current.api as any).patch(path, body, options),
      delete: (path: string, options?: any) => (stabilityRef.current.api as any).delete(path, options),
    }), [stabilityRef]); // stable: delegates through stabilityRef so api changes don't recreate this object

    return { stableT, stableLoadConfig, stableGetFrontendMetadata, stableApiBridge };
  }
}
