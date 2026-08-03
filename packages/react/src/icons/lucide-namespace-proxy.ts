import type React from 'react';
import { LucideLazyLoader } from '@react/icons/lucide-lazy-loader';

/**
 * Builds the object published as `window.Lucide`.
 *
 * It stands in for `import * as Lucide from 'lucide-react'` without loading a
 * single icon implementation up front, so every existing consumer keeps working
 * verbatim:
 *
 *  - `window.Lucide.ChevronDown`                     -> lazy proxy component
 *  - `Object.keys(window.Lucide)`                    -> all 5,730 icon names,
 *    which is what `helpers/import-map-installer.ts` enumerates to emit one
 *    `export const` per icon for runtime-installed plugin bundles
 *  - `require('lucide-react')` via the UI_REQUIRE_SHIM in build-plugins.sh
 *  - `window.Lucide[someRuntimeString]`              -> resolves any name
 *
 * Property reads return a render-time proxy component, so an icon's ~450b chunk
 * is fetched only when it is actually rendered.
 */
export class LucideNamespaceProxy {
  /**
   * @param getIcon - Resolver returning a cached proxy component for a name.
   *                  Supplied by the runtime bridge so proxies are shared with
   *                  `FrameworkIcons.getIcon`.
   */
  static create(getIcon: (name: string) => React.ComponentType<any>): Record<string, unknown> {
    const target: Record<string, unknown> = {};

    return new Proxy(target, {
      get(_target, property, receiver) {
        if (property === '__esModule') return true;
        if (property === 'default') return receiver;
        if (typeof property !== 'string') return undefined;
        if (!LucideLazyLoader.has(property)) return undefined;
        return getIcon(property);
      },

      has(_target, property) {
        return typeof property === 'string' && LucideLazyLoader.has(property);
      },

      ownKeys() {
        return LucideLazyLoader.iconNames();
      },

      getOwnPropertyDescriptor(_target, property) {
        if (typeof property !== 'string' || !LucideLazyLoader.has(property)) return undefined;
        // `configurable: true` is required: a Proxy may not report a
        // non-configurable descriptor for a property absent from its target.
        return { enumerable: true, configurable: true, value: getIcon(property) };
      },
    });
  }
}
