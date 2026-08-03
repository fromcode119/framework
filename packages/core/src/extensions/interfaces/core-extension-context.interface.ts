
import type { ILoadedCoreExtension } from '@core/extensions/interfaces/loaded-core-extension.interface';

export interface ICoreExtensionContext {
  /** Extension metadata */
  extension: ILoadedCoreExtension;
  
  /** Framework services available to extensions */
  services: {
    /** Logger instance */
    logger: any;
    
    /** Database access */
    db: any;
    
    /** Integration manager for registering integration types */
    integrations: any;
    
    /** Hook manager for events */
    hooks: any;
    
    /** Plugin manager for accessing plugins */
    plugins?: any;
  };
  
  /** Register capabilities this extension provides */
  registerCapability: (capability: string) => void;
  
  /** Unregister a previously registered capability */
  unregisterCapability: (capability: string) => void;
  
  /** Get all capabilities registered by this extension */
  getRegisteredCapabilities: () => string[];
  
  /** Register admin UI components */
  registerAdminSlot?: (slot: string, component: any, priority?: number) => void;

  /** Register API routes exposed by this extension */
  registerApiRoute?: (routeKey: string, factory: any) => void;
}
