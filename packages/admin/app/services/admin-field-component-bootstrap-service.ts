import { SystemLocaleField } from '@/components/collection/fields/view/system-locale-field.client';
import { SystemLocalesField } from '@/components/collection/fields/view/system-locales-field.client';
import { CountryField } from '@/components/collection/fields/view/country-field.client';
import { ThemeLayoutField } from '@/components/collection/fields/view/theme-layout-field.client';
import { StructuredReadOnlyField } from '@/components/collection/fields/view/structured-read-only-field.client';
import { AddressField } from '@/components/collection/fields/view/address-field.client';
import { PersonFieldPicker } from '@/components/collection/fields/view/person-field-picker.client';
import { PersonField } from '@/components/collection/fields/view/person-field.client';
import { HtmlEditorField } from '@/components/collection/fields/view/html-editor-field.client';
import { MediaRelationField } from '@/components/collection/view/media-relation-field.client';

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
    SystemLocalesField,
    CountryField,
    ThemeLayoutField,
    StructuredReadOnlyField,
    AddressField,
    PersonField,
    // One of the site's person fields, by key — where a question's answer is saved.
    PersonFieldPicker,
    HtmlEditor: HtmlEditorField,
    // The media picker for a field that stores ONE file reference as text (`91`, `theme:<path>`) — a
    // `relationship` is a JSONB column, and an existing TEXT column is never retyped.
    MediaField: MediaRelationField,
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
