import { FrameworkIcons, FrameworkIconRegistry } from '@fromcode119/react';
import type { IconName } from '@fromcode119/react';

const IconNames = FrameworkIcons.iconNames();

// Register system icons with the global registry
if (typeof window !== 'undefined') {
  // @ts-ignore
  const registry = FrameworkIconRegistry || (FrameworkIcons && FrameworkIcons['FrameworkIconRegistry']);
  const icons = FrameworkIcons;
  
  // @ts-ignore
  if (registry && typeof registry.registerProvider === 'function') {
    // @ts-ignore
    registry.registerProvider('system', icons);
    // @ts-ignore
    window.FrameworkIcons = icons;
    // @ts-ignore
    window.FrameworkIconRegistry = registry;
  } else {
    // Fallback: set it anyway if icons exist
    // @ts-ignore
    if (icons) window.FrameworkIcons = icons;
  }
}

// Ensure we are exporting the object correctly
// @ts-ignore
export const Icons = FrameworkIcons;
export { FrameworkIcons, IconNames };
export type { IconName };
