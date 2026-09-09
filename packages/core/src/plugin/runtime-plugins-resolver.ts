import type { IPluginApiResolver } from '@core/interfaces/plugin-api-resolver.interface';
import { RuntimeBridge } from '@core/runtime-bridge';

export class RuntimePluginsResolver implements IPluginApiResolver {
  has(namespace: string, slug: string): boolean {
    const bridge = RuntimeBridge.getBridge<any>();
    if (typeof bridge?.hasPluginApi === 'function') {
      return !!bridge.hasPluginApi(namespace, slug);
    }

    return this.resolve(namespace, slug) !== undefined;
  }

  resolve(namespace: string, slug: string): unknown {
    const bridge = RuntimeBridge.getBridge<any>();
    if (typeof bridge?.getPluginApi === 'function') {
      return bridge.getPluginApi(namespace, slug);
    }

    return undefined;
  }
}
