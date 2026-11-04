import { Platform } from '@fromcode119/react-class-components';
import { FrameworkIcons, FrameworkIconRegistry } from '@fromcode119/react';

export class AdminIconRegistryBootstrapService {
  private static installed = false;

  static install(): void {
    if (!Platform.isBrowser) {
      return;
    }

    if (AdminIconRegistryBootstrapService.installed) {
      return;
    }

    // Publish the admin's eagerly-bundled icons through the shared registry's provider mechanism —
    // no bare window.FrameworkIcons global. The framework bridge already carries FrameworkIcons for readers.
    FrameworkIconRegistry.registerProvider('system', FrameworkIcons as unknown as Record<string, any>);
    AdminIconRegistryBootstrapService.installed = true;
  }
}