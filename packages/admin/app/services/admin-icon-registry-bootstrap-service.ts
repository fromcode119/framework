import { FrameworkIcons, FrameworkIconRegistry } from '@fromcode119/react';

export class AdminIconRegistryBootstrapService {
  static install(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const globalWindow = window as typeof window & Record<string, unknown>;
    if (globalWindow.__fromcodeAdminIconRegistryInstalled) {
      return;
    }

    FrameworkIconRegistry.registerProvider('system', FrameworkIcons as unknown as Record<string, any>);
    globalWindow.FrameworkIcons = FrameworkIcons;
    globalWindow.FrameworkIconRegistry = FrameworkIconRegistry;
    globalWindow.__fromcodeAdminIconRegistryInstalled = true;
  }
}