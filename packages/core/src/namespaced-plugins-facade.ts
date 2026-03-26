import type { PluginApiResolver } from './plugin-api-resolver.interfaces';

export class NamespacedPluginsFacade {
  constructor(
    private readonly resolver: PluginApiResolver,
    private readonly namespaceValue: string,
  ) {}

  has(slug: string): boolean {
    return this.resolver.has(this.namespaceValue, slug);
  }

  get(slug: string): any {
    return this.resolver.resolve(this.namespaceValue, slug);
  }

  require(slug: string): any {
    const api = this.get(slug);
    if (api === null || api === undefined) {
      throw new Error(`Plugin "${slug}" is not available in namespace "${this.namespaceValue}".`);
    }

    return api;
  }

  getNamespace(): string {
    return this.namespaceValue;
  }

  static create(resolver: PluginApiResolver, namespace: string): NamespacedPluginsFacade {
    const facade = new NamespacedPluginsFacade(resolver, namespace);

    return new Proxy(facade, {
      get(target, prop, receiver) {
        if (typeof prop !== 'string' || prop === 'then' || Reflect.has(target, prop)) {
          return Reflect.get(target, prop, receiver);
        }

        return target.get(prop);
      },
    });
  }
}
