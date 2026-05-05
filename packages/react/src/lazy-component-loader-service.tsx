import React from 'react';

export class LazyComponentLoaderService {
  /**
   * Creates a suspended component from a module loader.
   *
   * @example
   * const Footer = LazyComponentLoaderService.component(() => import('./footer'));
   * const Banner = LazyComponentLoaderService.component(() => import('./banner'), {
   *   exportName: 'Banner',
   * });
   */
  static component(
    loadModule: () => Promise<{ default: React.ComponentType<any> }>,
    options?: { displayName?: string; fallback?: React.ReactNode },
  ): React.ComponentType<any>;

  static component(
    loadModule: () => Promise<Record<string, any>>,
    options: { exportName: string; displayName?: string; fallback?: React.ReactNode },
  ): React.ComponentType<any>;

  static component(
    loadModule: (() => Promise<{ default: React.ComponentType<any> }>) | (() => Promise<Record<string, any>>),
    options: { exportName?: string; displayName?: string; fallback?: React.ReactNode } = {},
  ): React.ComponentType<any> {
    if (options.exportName) {
      return LazyComponentLoaderService.createSuspendedNamed(
        loadModule as () => Promise<Record<string, any>>,
        options.exportName,
        options.displayName || options.exportName,
        options.fallback,
      );
    }

    return LazyComponentLoaderService.createSuspendedDefault(
      loadModule as () => Promise<{ default: React.ComponentType<any> }>,
      options.displayName,
      options.fallback,
    );
  }

  /**
   * Creates a keyed registry of suspense-wrapped named-export components.
   *
   * @example
   * const pages = LazyComponentLoaderService.createNamedRegistry({
   *   about: {
   *     loadModule: () => import('./about-page'),
   *     exportName: 'AboutPage',
   *   },
   * });
   */
  static createNamedRegistry<TKeys extends string>(
    definitions: Record<TKeys, {
      loadModule: () => Promise<Record<string, any>>;
      exportName: string;
      displayName?: string;
      fallback?: React.ReactNode;
    }>,
  ): Record<TKeys, React.ComponentType<any>> {
    const registry = {} as Record<TKeys, React.ComponentType<any>>;

    for (const [key, definition] of Object.entries(definitions) as Array<[
      TKeys,
      {
        loadModule: () => Promise<Record<string, any>>;
        exportName: string;
        displayName?: string;
        fallback?: React.ReactNode;
      },
    ]>) {
      registry[key] = LazyComponentLoaderService.component(definition.loadModule, {
        exportName: definition.exportName,
        displayName: definition.displayName,
        fallback: definition.fallback,
      });
    }

    return registry;
  }

  /**
   * Lazily resolves a module's default export as a React component.
   *
   * @example
   * const Footer = LazyComponentLoaderService.loadDefault(() => import('./footer'));
   */
  static loadDefault(
    loadModule: () => Promise<{ default: React.ComponentType<any> }>,
  ): React.LazyExoticComponent<React.ComponentType<any>> {
    return React.lazy(loadModule);
  }

  /**
   * Lazily resolves a named module export as a React component.
   *
   * @example
   * const Dialog = LazyComponentLoaderService.loadNamed(() => import('./dialog'), 'Dialog');
   */
  static loadNamed(
    loadModule: () => Promise<Record<string, any>>,
    exportName: string,
  ): React.LazyExoticComponent<React.ComponentType<any>> {
    return React.lazy(async () => {
      const loadedModule = await loadModule();
      return { default: LazyComponentLoaderService.resolveNamedComponent(loadedModule, exportName) };
    });
  }

  /**
   * Creates a suspense-wrapped component from a default export module.
   *
   * @example
   * const Footer = LazyComponentLoaderService.createSuspendedDefault(() => import('./footer'));
   */
  static createSuspendedDefault(
    loadModule: () => Promise<{ default: React.ComponentType<any> }>,
    displayName?: string,
    fallback: React.ReactNode = null,
  ): React.ComponentType<any> {
    return LazyComponentLoaderService.createSuspenseBoundary(
      LazyComponentLoaderService.loadDefault(loadModule),
      displayName,
      fallback,
    );
  }

  /**
   * Creates a suspense-wrapped component from a named export module.
   *
   * @example
   * const MediaPicker = LazyComponentLoaderService.createSuspendedNamed(() => import('./picker'), 'MediaPicker');
   */
  static createSuspendedNamed(
    loadModule: () => Promise<Record<string, any>>,
    exportName: string,
    displayName?: string,
    fallback: React.ReactNode = null,
  ): React.ComponentType<any> {
    return LazyComponentLoaderService.createSuspenseBoundary(
      LazyComponentLoaderService.loadNamed(loadModule, exportName),
      displayName || exportName,
      fallback,
    );
  }

  private static createSuspenseBoundary(
    LazyComponent: React.LazyExoticComponent<React.ComponentType<any>>,
    displayName?: string,
    fallback: React.ReactNode = null,
  ): React.ComponentType<any> {
    function SuspendedLazyComponent(props: any) {
      return (
        <React.Suspense fallback={fallback}>
          <LazyComponent {...props} />
        </React.Suspense>
      );
    }

    SuspendedLazyComponent.displayName = displayName || 'SuspendedLazyComponent';
    return SuspendedLazyComponent;
  }

  private static resolveNamedComponent(
    loadedModule: Record<string, any>,
    exportName: string,
  ): React.ComponentType<any> {
    const resolvedComponent = loadedModule[exportName];
    if (!resolvedComponent) {
      throw new Error(`Lazy component export "${exportName}" was not found in the loaded module.`);
    }
    return resolvedComponent;
  }
}
