import { FrameworkIcons, FrameworkIconRegistry, IconName, IconNames } from '@fromcode/react';

// Register system icons with the global registry
if (typeof window !== 'undefined') {
  const registry = FrameworkIconRegistry || (FrameworkIcons as any)?.FrameworkIconRegistry;
  const icons = FrameworkIcons;
  
  if (registry && typeof registry.registerProvider === 'function') {
    registry.registerProvider('system', icons);
  }
}

export { FrameworkIcons, IconNames };
export type { IconName };
