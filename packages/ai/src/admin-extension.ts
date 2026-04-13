import { AdminAssistantPage } from './admin-assistant-page';
import type { AdminExtensionBridge } from './admin-extension.types';
import { AppPathConstants } from '@fromcode119/core/client';

export class AdminExtensionRegistry {
  static registerAdminExtension(bridge: AdminExtensionBridge) {
      // Register Atlantis Intelligence UI component to admin.minimal.root slot
      bridge.registerSlotComponent('admin.minimal.root', AdminAssistantPage, 'ai', 100);

      // Register navigation menu item for Atlantis Intelligence
      bridge.registerMenuItem({
        label: 'Atlantis Intelligence',
        path: AppPathConstants.ADMIN.MINIMAL,
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
