export type AdminExtensionBridge = {
  registerSlotComponent: (slotName: string, component: any, pluginSlug?: string, priority?: number) => void;
  registerMenuItem: (item: {
    label: string;
    path: string;
    icon?: string;
    priority?: number;
    pluginSlug: string;
    group?: string;
  }) => void;
};

export type AdminExtensionModule = {
  registerAdminExtension?: (bridge: AdminExtensionBridge) => void;
};

/**
 * Dynamic extension loader for optional core extensions
 * Attempts to load AI admin extension, failing gracefully if unavailable
 */
async function loadAiExtension(): Promise<AdminExtensionModule> {
  try {
    // Try to dynamically import the AI package root exports
    const aiAdmin = (await import('@fromcode119/ai')) as {
      registerAdminExtension?: unknown;
      AdminExtensionRegistry?: {
        registerAdminExtension?: unknown;
      };
    };
    const directRegister =
      typeof aiAdmin.registerAdminExtension === 'function'
        ? (aiAdmin.registerAdminExtension as (bridge: AdminExtensionBridge) => void)
        : undefined;
    const registryRegister =
      aiAdmin.AdminExtensionRegistry && typeof aiAdmin.AdminExtensionRegistry.registerAdminExtension === 'function'
        ? (aiAdmin.AdminExtensionRegistry.registerAdminExtension as (bridge: AdminExtensionBridge) => void)
        : undefined;
    const registerAdminExtension: AdminExtensionModule['registerAdminExtension'] = directRegister || registryRegister;

    return { registerAdminExtension };
  } catch (error: any) {
    // AI package not available or disabled - return empty module
    if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') {
      console.log('AI extension not available (optional dependency)');
      return {};
    }
    // Other errors should be logged but not crash
    console.error('Failed to load AI admin extension:', error);
    return {};
  }
}

export const adminExtensionLoaders: Array<() => Promise<AdminExtensionModule>> = [
  loadAiExtension,
];
