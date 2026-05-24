import type { PluginApiResolver } from './plugin-api-resolver.interfaces';

export class NamespacedPluginsFacade {
  constructor(
    private readonly resolver: PluginApiResolver,
    private readonly namespaceValue: string,
  ) {}

  has(slug: string): boolean {
    return this.resolver.has(this.namespaceValue, slug);
  }

  get<TApi = unknown>(slug: string): TApi | null {
    const api = this.resolver.resolve(this.namespaceValue, slug);
    return api === null || api === undefined ? null : api as TApi;
  }

  require<TApi = unknown>(slug: string): TApi {
    const api = this.get<TApi>(slug);
    if (api === null) {
      throw new Error(`Plugin "${slug}" is not available in namespace "${this.namespaceValue}".`);
    }

    return api;
  }

  hasMethod(slug: string, methodName: string): boolean {
    const api = this.get<Record<string, unknown>>(slug);
    return typeof api?.[methodName] === 'function';
  }

  requireMethod<TMethod extends (...args: any[]) => any>(slug: string, methodName: string): TMethod {
    const api = this.require<Record<string, unknown>>(slug);
    const method = api[methodName];
    if (typeof method !== 'function') {
      throw new Error(`Plugin "${slug}" does not expose method "${methodName}" in namespace "${this.namespaceValue}".`);
    }

    return method as TMethod;
  }

  async call<TReturn = unknown>(slug: string, methodName: string, ...args: unknown[]): Promise<TReturn | null> {
    if (!this.hasMethod(slug, methodName)) {
      return null;
    }

    const method = this.requireMethod<(...methodArgs: unknown[]) => TReturn | Promise<TReturn>>(slug, methodName);
    return await method(...args);
  }

  async getCapabilities(slug: string, input?: unknown): Promise<Record<string, unknown> | null> {
    return await this.call<Record<string, unknown> | null>(slug, 'getCapabilities', input);
  }

  async getOperations(slug: string, input?: unknown): Promise<Record<string, unknown>> {
    const capabilities = await this.getCapabilities(slug, input);
    const operations = capabilities?.operations;
    return operations && typeof operations === 'object' ? operations as Record<string, unknown> : {};
  }

  async supportsOperation(slug: string, operationName: string, input?: unknown): Promise<boolean> {
    const operations = await this.getOperations(slug, input);
    return operations[operationName] === true;
  }

  async callOperation<TReturn = unknown>(slug: string, operationName: string, ...args: unknown[]): Promise<TReturn | null> {
    if (!(await this.supportsOperation(slug, operationName))) {
      return null;
    }

    return await this.call<TReturn>(slug, operationName, ...args);
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
