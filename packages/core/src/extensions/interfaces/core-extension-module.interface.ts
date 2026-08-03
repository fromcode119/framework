import type { ICoreExtensionContext } from '@core/extensions/interfaces/core-extension-context.interface';

export interface ICoreExtensionModule {
  /** Called when extension is first loaded */
  onInit?: (context: ICoreExtensionContext) => Promise<void> | void;
  
  /** Called when extension is enabled */
  onEnable?: (context: ICoreExtensionContext) => Promise<void> | void;
  
  /** Called when extension is disabled */
  onDisable?: (context: ICoreExtensionContext) => Promise<void> | void;
}
