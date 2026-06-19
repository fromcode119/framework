import { AppEnv } from './env';
import type { AdminExtensionBridge, AdminExtensionModule } from './admin-extensions.types';

/**
 * Dynamic loader registry for optional core admin extensions. Each loader attempts to load an
 * optional extension (e.g. the AI admin extension), failing gracefully if unavailable.
 */
export class AdminExtensions {
  static readonly loaders: Array<() => Promise<AdminExtensionModule>> = [
    () => AdminExtensions.loadAiExtension(),
  ];

  private static async loadAiExtension(): Promise<AdminExtensionModule> {
    if (!AppEnv.AI_ENABLED) {
      return {};
    }

    try {
      const aiAdmin = (await import('@fromcode119/ai/admin')) as {
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
}
