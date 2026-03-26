import type { PluginApiResolver } from './plugin-api-resolver.interfaces';
import { NamespacedPluginsFacade } from './namespaced-plugins-facade';

export class PluginsFacade {
  constructor(private readonly resolver: PluginApiResolver) {}

  namespace(namespace: string): NamespacedPluginsFacade {
    return NamespacedPluginsFacade.create(this.resolver, namespace);
  }

  has(namespace: string, slug: string): boolean {
    return this.resolver.has(namespace, slug);
  }

  get(namespace: string, slug: string): any {
    return this.resolver.resolve(namespace, slug);
  }
}
