export class AdminThemeEntryScriptGuardService {
  static install(): void {
    if (typeof window === 'undefined' || typeof Element === 'undefined') {
      return;
    }

    const globalWindow = window as typeof window & Record<string, any>;
    if (globalWindow.__fromcodeAdminThemeEntryScriptGuardInstalled) {
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

      return originalAppendChild.call(this, node);
    };

    globalWindow.__fromcodeAdminThemeEntryScriptGuardInstalled = true;
  }
}
