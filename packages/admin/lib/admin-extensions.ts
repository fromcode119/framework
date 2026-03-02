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

export const adminExtensionLoaders: Array<() => Promise<AdminExtensionModule>> = [
  () => import('@fromcode119/ai/admin'),
];
