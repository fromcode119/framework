import type { MutableRefObject } from 'react';
import { CoreServices } from '@fromcode119/core/client';

export class PluginLoaderThemeTracker {
  static reconcile(args: {
    pluginList: any[];
    themeSlug: string | undefined;
    previousThemeSlugRef: MutableRefObject<string>;
    previousPluginOwnersRef: MutableRefObject<Array<{ namespace: string; pluginSlug: string }>>;
  }): void {
    const { pluginList, themeSlug, previousThemeSlugRef, previousPluginOwnersRef } = args;
    const runtimeBridge = CoreServices.getInstance().defaultDesignRuntimeBridge;
    const currentThemeSlug = String(themeSlug || '').trim();
    const previousThemeSlug = previousThemeSlugRef.current;

    if (previousThemeSlug && previousThemeSlug !== currentThemeSlug) {
      runtimeBridge.unregisterByTheme(previousThemeSlug);
    }

    previousThemeSlugRef.current = currentThemeSlug;

    const currentOwners = pluginList
      .map((plugin: any) => ({
        namespace: String(plugin?.namespace || plugin?.manifest?.namespace || '').trim(),
        pluginSlug: String(plugin?.slug || '').trim(),
      }))
      .filter((owner) => owner.namespace && owner.pluginSlug);
    const currentOwnerKeys = new Set(currentOwners.map((owner) => `${owner.namespace}:${owner.pluginSlug}`));

    previousPluginOwnersRef.current.forEach((owner) => {
      const key = `${owner.namespace}:${owner.pluginSlug}`;
      if (!currentOwnerKeys.has(key)) {
        runtimeBridge.unregisterByPlugin(owner.namespace, owner.pluginSlug);
      }
    });

    previousPluginOwnersRef.current = currentOwners;
  }
}
