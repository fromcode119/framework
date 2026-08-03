import type { IAdminExtensionBridge } from '@/lib/interfaces/admin-extension-bridge.interface';

/** The shape an admin-extension module exports so the loader can wire it. */
export interface IAdminExtensionModule {
  registerAdminExtension?: (bridge: IAdminExtensionBridge) => void;
}
