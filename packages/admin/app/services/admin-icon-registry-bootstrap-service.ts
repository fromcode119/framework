import { Platform } from '@fromcode119/reactor';
import { FrameworkIcons, FrameworkIconRegistry } from '@fromcode119/react';

export class AdminIconRegistryBootstrapService {
  static install(): void {
    if (!Platform.isBrowser) {
      return;
    }

    const globalWindow = window as typeof window & Record<string, unknown>;
    if (globalWindow.__fromcodeAdminIconRegistryInstalled) {
      return;
    }

    // Publish the admin's eagerly-bundled icons through the shared registry's provider mechanism —
    // no bare window.FrameworkIcons global. The framework bridge already carries FrameworkIcons for readers.
    FrameworkIconRegistry.registerProvider('system', FrameworkIcons as unknown as Record<string, any>);
    globalWindow.__fromcodeAdminIconRegistryInstalled = true;
  }
}