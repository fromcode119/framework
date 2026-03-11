'use client';

import { useEffect } from 'react';
import { ContextHooks } from '@fromcode119/react';
import { adminExtensionLoaders } from '@/lib/admin-extensions';
import type { AdminExtensionBridge, AdminExtensionModule } from '@/lib/admin-extensions';

type AdminExtensionDynamicModule = AdminExtensionModule & {
  default?: AdminExtensionModule;
};

function resolveRegisterAdminExtension(
  module: AdminExtensionDynamicModule,
): AdminExtensionModule['registerAdminExtension'] {
  if (typeof module?.registerAdminExtension === 'function') {
    return module.registerAdminExtension;
  }
  if (typeof module?.default?.registerAdminExtension === 'function') {
    return module.default.registerAdminExtension;
  }
  return undefined;
}

export default function AdminExtensionLoader() {
  const { registerSlotComponent, registerMenuItem, refreshVersion } = ContextHooks.usePlugins();

  useEffect(() => {
    let cancelled = false;
    const bridge: AdminExtensionBridge = { registerSlotComponent, registerMenuItem };

    const loadExtensions = async () => {
      // Load extension modules from admin-extensions.ts
      for (const load of adminExtensionLoaders) {
        try {
          const module = (await load()) as AdminExtensionDynamicModule;
          if (cancelled) return;
          const register = resolveRegisterAdminExtension(module);

          if (register) {
            register(bridge);
          }
        } catch (error) {
          console.warn('[Admin] Failed to load admin extension module', error);
        }
      }
    };

    loadExtensions();

    return () => {
      cancelled = true;
    };
  }, [registerSlotComponent, registerMenuItem, refreshVersion]);

  return null;
}
