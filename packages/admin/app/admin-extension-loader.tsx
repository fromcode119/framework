'use client';

import { useEffect } from 'react';
import { usePlugins } from '@fromcode119/react';
import { registerAdminExtension as registerAiAdminExtension } from '@fromcode119/ai/admin';
import { adminExtensionLoaders } from '@/lib/admin-extensions';

export default function AdminExtensionLoader() {
  const { registerSlotComponent, registerMenuItem, refreshVersion } = usePlugins();

  useEffect(() => {
    let cancelled = false;
    const bridge = { registerSlotComponent, registerMenuItem };

    const loadExtensions = async () => {
      try {
        registerAiAdminExtension(bridge);
      } catch (error) {
        console.warn('[Admin] Failed to register built-in AI extension', error);
      }

      for (const load of adminExtensionLoaders) {
        try {
          const module = await load();
          if (cancelled) return;
          const register =
            typeof module?.registerAdminExtension === 'function'
              ? module.registerAdminExtension
              : typeof (module as any)?.default?.registerAdminExtension === 'function'
                ? (module as any).default.registerAdminExtension
                : null;

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
