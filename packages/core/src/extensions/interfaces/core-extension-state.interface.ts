export interface ICoreExtensionState {
  /** Extension slug */
  slug: string;
  
  /** Whether extension is enabled */
  enabled: boolean;
  
  /** Configuration */
  config?: Record<string, any>;
  
  /** Last updated timestamp */
  updatedAt?: Date;
}
