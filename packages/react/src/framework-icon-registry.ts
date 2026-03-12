import type React from 'react';
import * as Lucide from 'lucide-react';
import { IconRegistry } from './icon-registry';

export class FrameworkIconRegistry {
  private static readonly registry = FrameworkIconRegistry.createRegistry();

  static registerProvider(name: string, provider: Record<string, any>): void {
    FrameworkIconRegistry.registry.registerProvider(name, provider);
  }

  static getIcon(name: string): React.ComponentType<any> | null {
    return FrameworkIconRegistry.registry.getIcon(name);
  }

  private static createRegistry(): IconRegistry {
    const registry = new IconRegistry();
    registry.registerProvider('lucide', Lucide);
    return registry;
  }
}
