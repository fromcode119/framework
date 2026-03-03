'use client';

import { useEffect } from 'react';
import { usePlugins } from '@fromcode119/react';
import { adminExtensionLoaders } from '@/lib/admin-extensions';

// Dynamic AI extension loader (optional dependency)
async function loadAiAdminExtension() {
  try {
    const aiModule = await import('@fromcode119/ai/admin');
    return aiModule.registerAdminExtension;
  } catch (error: any) {
    if (error?.code === 'MODULE_NOT_FOUND') {
      console.log('[Admin] AI extension not available (optional dependency)');
      return null;
    }
    throw error;
  }
}

export default function AdminExtensionLoader() {
  const { registerSlotComponent, registerMenuItem, refreshVersion } = usePlugins();

  useEffect(() => {
    let cancelled = false;
    const bridge = { registerSlotComponent, registerMenuItem };

    const loadExtensions = async () => {
      // Load built-in AI extension if available
      try {
        const registerAiAdminExtension = await loadAiAdminExtension();
        if (registerAiAdminExtension && !cancelled) {
          registerAiAdminExtension(bridge);
        }
      } catch (error) {
        console.warn('[Admin] Failed to register built-in AI extension', error);
      }

      // Load extension modules from admin-extensions.ts
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
