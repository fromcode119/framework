import { IAdminPluginMetadata } from '@/app/interfaces/admin-plugin-metadata.interface';
import type { IPluginAssetLoaderCallbacks } from '@/app/services/interfaces/plugin-asset-loader-callbacks.interface';

export interface IPluginAssetLoaderContext {
  plugins: IAdminPluginMetadata[];
  refreshVersion: number;
  callbacks: IPluginAssetLoaderCallbacks;
}
