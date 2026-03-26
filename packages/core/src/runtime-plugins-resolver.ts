import type { PluginApiResolver } from './plugin-api-resolver.interfaces';
import { RuntimeBridge } from './runtime-bridge';

export class RuntimePluginsResolver implements PluginApiResolver {
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
