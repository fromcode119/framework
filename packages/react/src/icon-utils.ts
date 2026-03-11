import React, { forwardRef, createElement } from 'react';
// NOTE: Circular import is intentional and safe — FrameworkIconRegistry is only
// accessed at render-time (inside the returned component), never at module-init
// time, so both modules are fully resolved before the value is consumed.
import { FrameworkIconRegistry } from './framework-icon-registry';

/**
 * Utility class for icon-related helper operations.
 *
 * Extracted from icons.tsx so that class definitions live in plain .ts files
 * rather than .tsx files (project convention).
 */
export class IconUtils {
  /**
   * Creates a stable React forward-ref component that lazily resolves to the
   * real icon at render time via the global {@link FrameworkIconRegistry}.
   *
   * @param name - The icon name to proxy (matched against all registered providers)
   * @returns A memoised ForwardRef component whose displayName includes the icon name
   */
  static createProxyIcon(
    name: string,
  ): React.ForwardRefExoticComponent<Omit<any, 'ref'> & React.RefAttributes<unknown>> {
    const ProxyIcon = forwardRef((props: any, ref) => {
      const Icon = FrameworkIconRegistry.getIcon(name);

      if (!Icon) {
        if (typeof window !== 'undefined' && (window as any).console) {
          if (!(window as any)._missingIcons) (window as any)._missingIcons = new Set();
          if (!(window as any)._missingIcons.has(name)) {
            (window as any)._missingIcons.add(name);
            console.warn(`[Icons] Icon "${name}" not found in any registered provider.`);
          }
        }
        return null;
      }

      return createElement(Icon, { ...props, ref });
    });

    ProxyIcon.displayName = `ProxyIcon(${name})`;
    return ProxyIcon;
  }
}
