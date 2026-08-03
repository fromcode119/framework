export interface ICoreExtensionManifest {
  /** Unique identifier (matches package directory name) */
  slug: string;
  
  /** Display name */
  name: string;
  
  /** Version (matches package.json version) */
  version: string;
  
  /** Type must be 'core-extension' to differentiate from plugins */
  type: 'core-extension';
  
  /** Description */
  description: string;
  
  /** Author */
  author?: string;
  
  /** Entry point for extension initialization */
  main?: string;
  
  /** Custom API route path (if different from slug). Extension routes will be mounted at /api/{apiPath} */
  apiPath?: string;
  
  /** Capabilities this extension requires from the framework */
  capabilities?: string[];
  
  /** Admin panel integration configuration */
  admin?: {
    /** Admin group/category */
    group?: string;
    
    /** Icon name (from icon pack) */
    icon?: string;
    
    /** UI slots this extension registers */
    slots?: Array<{
      slot: string;
      component: string;
      priority?: number;
    }>;
    
    /** Routes to register */
    routes?: Array<{
      path: string;
      component: string;
    }>;
  };
  
  /** Dependencies on other extensions or framework version */
  dependencies?: {
    framework?: string;
    extensions?: Record<string, string>;
  };
}
