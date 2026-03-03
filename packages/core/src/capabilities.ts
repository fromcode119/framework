/**
 * Runtime Capability Registry
 * 
 * Tracks which optional features/extensions are available at runtime.
 * Extensions register their capabilities during initialization.
 * Code can check capabilities before using extension-specific features.
 */

export class CapabilityRegistry {
  private capabilities = new Set<string>();
  private metadata = new Map<string, CapabilityMetadata>();

  /**
   * Register a capability as available
   */
  register(capability: string, meta?: Partial<CapabilityMetadata>): void {
    this.capabilities.add(capability);
    
    if (meta) {
      this.metadata.set(capability, {
        provider: meta.provider || 'unknown',
        version: meta.version,
        description: meta.description,
      });
    }
  }

  /**
   * Unregister a capability
   */
  unregister(capability: string): void {
    this.capabilities.delete(capability);
    this.metadata.delete(capability);
  }

  /**
   * Check if a capability is available
   */
  has(capability: string): boolean {
    return this.capabilities.has(capability);
  }

  /**
   * Check if all capabilities are available
   */
  hasAll(...capabilities: string[]): boolean {
    return capabilities.every((cap) => this.has(cap));
  }

  /**
   * Check if any capability is available
   */
  hasAny(...capabilities: string[]): boolean {
    return capabilities.some((cap) => this.has(cap));
  }

  /**
   * Get all registered capabilities
   */
  list(): string[] {
    return Array.from(this.capabilities);
  }

  /**
   * Get capability metadata
   */
  getMetadata(capability: string): CapabilityMetadata | undefined {
    return this.metadata.get(capability);
  }

  /**
   * Clear all capabilities
   */
  clear(): void {
    this.capabilities.clear();
    this.metadata.clear();
  }
}

export interface CapabilityMetadata {
  /** Extension or package that provides this capability */
  provider: string;
  
  /** Version of the capability provider */
  version?: string;
  
  /** Human-readable description */
  description?: string;
}

/**
 * Global capability registry instance
 * Used by extensions to register capabilities and by code to check availability
 */
export const capabilities = new CapabilityRegistry();
