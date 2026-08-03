import { ExtensionState } from '@core/extensions/enums/extension-state.enum';
import type { ICoreExtensionManifest } from '@core/extensions/interfaces/core-extension-manifest.interface';
import type { ICoreExtensionModule } from '@core/extensions/interfaces/core-extension-module.interface';

export interface ILoadedCoreExtension {
  /** Extension metadata */
  manifest: ICoreExtensionManifest;
  
  /** Absolute path to extension directory */
  path: string;
  
  /** Current state */
  state: ExtensionState;

  /** Error message if state is ExtensionState.ERROR */
  error?: string;
  
  /** Loaded module exports (onInit, onEnable, onDisable functions) */
  module?: ICoreExtensionModule;
}
