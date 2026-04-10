import { PluginManager } from '@fromcode119/core';

export class PluginPublicApiResolver {
  constructor(private readonly manager: PluginManager) {}

  listInstalledPlugins(): any[] {
    return this.manager.getSortedPlugins(this.manager.getPlugins());
  }

  listActivePlugins(): any[] {
    return this.listInstalledPlugins()
      .filter((plugin: any) => String(plugin?.state || '').trim().toLowerCase() === 'active');
  }

  resolvePublicApi(plugin: any): unknown {
    const publicApi = plugin?.publicAPI;
    if (!publicApi) {
      return null;
    }

    if (typeof publicApi !== 'function') {
      return publicApi;
    }

    if (this.hasStaticMethods(publicApi)) {
      return publicApi;
    }

    try {
      const context = this.manager.createContext(plugin);
      const resolved = publicApi(context);
      return resolved && typeof resolved === 'object' ? resolved : null;
    } catch {
      return null;
    }
  }

  listMethodNames(publicApi: unknown): string[] {
    if (!publicApi || (typeof publicApi !== 'object' && typeof publicApi !== 'function')) {
      return [];
    }

    const excluded = new Set([
      'length',
      'name',
      'prototype',
      'caller',
      'arguments',
    ]);

    return Object.getOwnPropertyNames(publicApi)
      .filter((name) => !excluded.has(name))
      .filter((name) => typeof (publicApi as any)[name] === 'function')
      .sort((left, right) => left.localeCompare(right));
  }

  private hasStaticMethods(publicApi: Function): boolean {
    return this.listMethodNames(publicApi).length > 0;
  }
}
