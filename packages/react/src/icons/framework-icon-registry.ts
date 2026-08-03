import type React from 'react';
import { IconRegistry } from '@react/icons/icon-registry';

export class FrameworkIconRegistry {
  private static readonly registry = new IconRegistry();

  static registerProvider(name: string, provider: Record<string, any>): void {
    FrameworkIconRegistry.registry.registerProvider(name, provider);
  }

  static getIcon(name: string): React.ComponentType<any> | null {
    return FrameworkIconRegistry.registry.getIcon(name);
  }
}
