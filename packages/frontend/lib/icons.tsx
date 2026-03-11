import { FrameworkIcons, FrameworkIconRegistry } from '@fromcode119/react';
import type { IconName } from '@fromcode119/react';

const IconNames = FrameworkIcons.iconNames();

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
