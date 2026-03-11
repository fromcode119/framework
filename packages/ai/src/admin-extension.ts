import { AdminAssistantPage } from './admin-assistant-page';
import type { AdminExtensionBridge } from './admin-extension.types';

export class AdminExtensionRegistry {
  static registerAdminExtension(bridge: AdminExtensionBridge) {
      // Register Forge assistant UI component to admin.minimal.root slot
      bridge.registerSlotComponent('admin.minimal.root', AdminAssistantPage, 'ai', 100);

      // Register navigation menu item for Forge assistant
      bridge.registerMenuItem({
        label: 'Forge',
        path: '/forge',
        icon: 'Zap',
        priority: 10,
        pluginSlug: 'ai',
        group: 'tools',
      });

      // Register AI integration config UI slot (if integration settings page exists)
      // This will be used by Settings > Integrations to show AI-specific config
      // bridge.registerSlotComponent('admin.integrations.ai', AiIntegrationSettings, 'ai', 100);

  }
}