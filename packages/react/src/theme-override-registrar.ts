import React from 'react';
import { ContextBridge } from './context-bridge';

export class ThemeOverrideRegistrar {
  static register(
    slots: Record<string, () => Promise<{ default: React.ComponentType<any> }>>,
    themeSlug: string,
    priority = 11,
  ): void {
    for (const [slotKey, loader] of Object.entries(slots)) {
      const Lazy = React.lazy(loader);
      ContextBridge.registerOverride(slotKey, ThemeOverrideRegistrar.withSuspense(Lazy), themeSlug, priority);
    }
  }

  private static withSuspense(Component: React.ComponentType<any>): React.ComponentType<any> {
    return function SuspenseWrapper(props: any) {
      return React.createElement(React.Suspense, { fallback: null }, React.createElement(Component, props));
    };
  }
}
