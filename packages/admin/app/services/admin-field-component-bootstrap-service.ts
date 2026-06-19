import { SystemLocaleField } from '@/components/collection/fields/system-locale-field';
import { CountryField } from '@/components/collection/fields/country-field';
import { ThemeLayoutField } from '@/components/collection/fields/theme-layout-field';

/**
 * Owns the framework's built-in collection field components and registers them into the live
 * field-component registry so any plugin can opt in via `admin.component: '<Name>'` (e.g. a
 * "pick a configured system locale" field) without re-implementing it per plugin. Registration
 * must run through the React context's `registerFieldComponent` (not the module-load ContextBridge,
 * which no-ops before the PluginsProvider mounts), so it is invoked from the admin hook boundary.
 */
export class AdminFieldComponentBootstrapService {
  private static readonly BUILTINS: Record<string, any> = {
    SystemLocaleField,
    CountryField,
    ThemeLayoutField,
  };

  static register(registerFieldComponent?: (name: string, component: any) => void): void {
    if (typeof registerFieldComponent !== 'function') {
      return;
    }
    Object.entries(AdminFieldComponentBootstrapService.BUILTINS).forEach(([name, component]) => {
      registerFieldComponent(name, component);
    });
  }
}
