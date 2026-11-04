import { Platform } from '@fromcode119/react-class-components';

export class AdminThemeEntryScriptGuardService {
  private static installed = false;

  static install(): void {
    if (!Platform.isBrowser || typeof Element === 'undefined') {
      return;
    }

    if (AdminThemeEntryScriptGuardService.installed) {
      return;
    }

    const existingScripts = document.querySelectorAll('script[data-theme-entry]');
    existingScripts.forEach((element) => {
      if (element instanceof HTMLScriptElement) {
        element.type = 'module';
        element.async = true;
      }
    });

    const originalAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function <T extends Node>(node: T): T {
      if (node instanceof HTMLScriptElement && node.getAttribute('data-theme-entry')) {
        node.type = 'module';
        node.async = true;
      }

      return originalAppendChild.call(this, node) as T;
    };

    AdminThemeEntryScriptGuardService.installed = true;
  }
}
