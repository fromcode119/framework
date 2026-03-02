import { AdminAssistantPage } from './admin-assistant-page';

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

export function registerAdminExtension(bridge: AdminExtensionBridge) {
  bridge.registerSlotComponent('admin.minimal.root', AdminAssistantPage, 'ai', 100);
}
