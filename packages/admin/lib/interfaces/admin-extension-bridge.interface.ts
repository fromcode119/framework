/** Bridge an admin extension uses to register slot components + menu items at load time. */
export interface IAdminExtensionBridge {
  registerSlotComponent: (slotName: string, component: any, pluginSlug?: string, priority?: number) => void;
  registerMenuItem: (item: {
    label: string;
    path: string;
    icon?: string;
    priority?: number;
    pluginSlug: string;
    group?: string;
  }) => void;
}
