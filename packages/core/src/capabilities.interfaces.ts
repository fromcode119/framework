export interface CapabilityMetadata {
  /** Extension or package that provides this capability */
  provider: string;
  
  /** Version of the capability provider */
  version?: string;
  
  /** Human-readable description */
  description?: string;
}
