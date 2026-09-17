import { ThemeMode } from '@fromcode119/core/client';
import { Reactor, prop, state, bound, ref, watch } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { AdminServices } from '@/lib/admin-services';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

/**
 * What one field renderer was handed, and what it reads from the platform around it.
 *
 * The base of the renderer's chain — access, then localization, then the markup. The order is the
 * dependency order: whether a field may be edited is stated using its label, and the value being
 * edited depends on whether it may be.
 */
export abstract class FieldRendererViewState extends Reactor {
  @prop declare field: ICollectionField;
  @prop declare value: any;
  @prop declare onChange: (value: any) => void;
  @prop declare theme: ThemeMode;
  @prop declare collectionSlug: string;
  @prop declare pluginSettings?: Record<string, any>;
  @prop declare pluginSettingsSchema?: Record<string, any>;
  @prop declare globalSettings?: Record<string, any>;
  @prop declare disabled?: boolean;
  @prop declare isNew?: boolean;
  @prop declare errors?: string[];
  @prop declare slugWarning?: string | null;
  @prop declare slugManuallyEdited?: boolean;
  @prop declare readOnlyOverrideGranted?: boolean;
  @prop declare onReadOnlyOverrideRequest?: (field: { name: string; label: string }) => void;
  @prop declare record?: Record<string, any>;
  @prop declare onPatch?: (partial: Record<string, any>) => void;
  /** Plugin registry from `ContextHooks.usePlugins()`, supplied by the thin functional shim. */
  @prop declare plugins: any;
  /** Owner of the collection being edited — resolved by the shim, used to link provenance to settings. */
  @prop declare pluginSlug?: string;

  @ref declare protected localeMenuRef: Ref<HTMLDivElement>;

  @state activeLocale = this.defaultLocale;
  @state isLocaleMenuOpen = false;

  protected outsideClickAttached = false;

  protected get localization() {
    return AdminServices.getInstance().localization;
  }

  /**
   * Where the configured locales come from: `globalSettings.localization_locales` (Settings →
   * Localization), which this component already receives as a prop.
   *
   * It used to read `(this.plugins as any).settings` — a key nothing supplies. Neither the admin runtime
   * provider nor `usePlugins()` puts `settings` on the plugins object, so the registry was ALWAYS empty
   * and the in-input locale switcher rendered a button whose menu had no entries. Clicking it looked
   * like a dead control rather than a missing list, which is why it was reported as "not working".
   */
  protected get registrySettings(): Record<string, any> {
    return this.globalSettings || {};
  }

  protected get localeRegistry(): Array<{ code: string; label: string }> {
    return this.localization.parseLocaleRegistry(this.registrySettings);
  }

  protected get defaultLocale(): string {
    return this.localization.resolveAdminLocale(this.registrySettings, this.localeRegistry);
  }

  protected get label(): string {
    const { field } = this;
    return field.label || field.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  }
}
