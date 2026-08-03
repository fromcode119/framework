import React, { forwardRef, createElement, useSyncExternalStore } from 'react';
import { Platform } from '@fromcode119/reactor';
// NOTE: Circular import is intentional and safe — FrameworkIconRegistry is only
// accessed at render-time (inside the returned component), never at module-init
// time, so both modules are fully resolved before the value is consumed.
import { FrameworkIconRegistry } from '@react/icons/framework-icon-registry';
import { LucideLazyLoader } from '@react/icons/lucide-lazy-loader';

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
   * Subscribes to {@link LucideLazyLoader} so an icon whose implementation chunk
   * is still in flight renders nothing on the first pass and swaps itself in as
   * soon as the chunk lands.
   *
   * @param name - The icon name to proxy (matched against all registered providers)
   * @returns A memoised ForwardRef component whose displayName includes the icon name
   */
  static createProxyIcon(
    name: string,
  ): React.ForwardRefExoticComponent<Omit<any, 'ref'> & React.RefAttributes<unknown>> {
    const ProxyIcon = forwardRef((props: any, ref) => {
      // Re-render when a lazily-loaded icon implementation becomes available.
      useSyncExternalStore(LucideLazyLoader.subscribe, LucideLazyLoader.getRevision, IconUtils.serverRevision);

      const Icon = FrameworkIconRegistry.getIcon(name);

      if (!Icon) {
        // A miss is expected while a chunk is in flight, so only warn for names
        // Lucide does not know at all — those will never resolve.
        if (Platform.isBrowser && (window as any).console && !LucideLazyLoader.has(name)) {
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
    // Marks this as a delegating proxy. IconRegistry.getIcon() skips tagged
    // components, so a lookup can never resolve to a proxy for the same name —
    // which would recurse forever.
    (ProxyIcon as any).__fcProxyIcon = true;
    return ProxyIcon;
  }

  private static serverRevision(): number {
    return 0;
  }
}
