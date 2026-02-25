import { FrameworkIcons, FrameworkIconRegistry, IconName, IconNames } from '@fromcode119/react';

// Register system icons with the global registry
if (typeof window !== 'undefined') {
  console.log('[Icons] Debug Info:', { 
    ImportedRegistry: FrameworkIconRegistry,
    ImportedIcons: FrameworkIcons,
    IconNamesExport: IconNames
  });
  
  // Use index access to avoid "as any" causing parse errors in some environments
  const registry = FrameworkIconRegistry || (FrameworkIcons as any)?.['FrameworkIconRegistry'];
  const icons = FrameworkIcons;
  
  if (registry && typeof (registry as any).registerProvider === 'function') {
    (registry as any).registerProvider('system', icons);
    (window as any).FrameworkIcons = icons;
    (window as any).FrameworkIconRegistry = registry;
    console.log('[Icons] Registry initialized successfully.');
  } else {
    console.warn('[Icons] Failed to initialize registry: symbols missing or mismatch.');
    // Fallback: set it anyway if icons exist
    if (icons) (window as any).FrameworkIcons = icons;
  }
}

// Ensure we are exporting the object correctly
export const Icons = FrameworkIcons;
export { FrameworkIcons, IconNames };
export type { IconName };
