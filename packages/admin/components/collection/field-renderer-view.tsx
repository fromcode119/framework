import { ThemeMode } from '@fromcode119/core/client';
import type { ReactElement, ReactNode, RefObject } from 'react';

import { Reactor, prop, state, bound, ref, watch } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { AdminServices } from '@/lib/admin-services';
import { AdminPathUtils } from '@/lib/admin-path';
import { FieldProvenance } from '@/lib/collection/field-provenance';
import { FieldRendererUtils } from '@/components/collection/field-renderer-utils';
import { FieldLocaleSwitcher } from '@/components/collection/field-locale-switcher';
import { FieldRendererHeader } from '@/components/collection/field-renderer-header';
import { FieldControlRenderer } from '@/components/collection/field-control-renderer';
import { FieldRendererFooter } from '@/components/collection/field-renderer-footer';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';
/**
 * Hook-free class body of {@link FieldRenderer}. The thin functional shim reads
 * `ContextHooks.usePlugins()` and passes the registry in as `plugins`; this class holds the
 * locale-menu state, the outside-click ref, and the two former `React.useEffect` blocks
 * (reproduced as `@watch` reactions + a componentDidMount seed and componentWillUnmount cleanup).
 */
export class FieldRendererView extends Reactor {
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

  /**
   * What the storefront actually uses for this field when the record leaves it empty, and which setting
   * decides it. Null unless the field declares `admin.fallback`, so nothing changes for fields that
   * simply mean what they say.
   */
  private get provenance(): FieldProvenance | null {
    return FieldProvenance.resolve(
      this.field.admin?.fallback,
      this.currentValue,
      this.record ?? {},
      this.pluginSettings ?? {},
      this.pluginSlug ? AdminPathUtils.toAdminPath(`/plugins/${this.pluginSlug}/settings`) : '',
      this.pluginSettingsSchema,
    );
  }

  @ref declare private localeMenuRef: Ref<HTMLDivElement>;

  @state activeLocale = this.defaultLocale;
  @state isLocaleMenuOpen = false;

  private outsideClickAttached = false;

  private get localization() {
    return AdminServices.getInstance().localization;
  }

  private get registrySettings(): Record<string, any> {
    return (this.plugins as any)?.settings || {};
  }

  private get localeRegistry(): Array<{ code: string; label: string }> {
    return this.localization.parseLocaleRegistry(this.registrySettings);
  }

  private get defaultLocale(): string {
    return this.localization.resolveAdminLocale(this.registrySettings, this.localeRegistry);
  }

  private get isLocalizedField(): boolean {
    return Boolean(this.field.localized);
  }

  // Effect 1: reset activeLocale to defaultLocale when the current locale is not in the registry.
  // Original deps: [activeLocale, defaultLocale, isLocalizedField, localeRegistry] — mapped to a
  // `@watch` on the underlying state (activeLocale) + prop (field/plugins) drivers of those values.
  @watch('activeLocale', 'field', 'plugins')
  private syncActiveLocale(): void {
    if (!this.isLocalizedField) return;
    const exists = this.localeRegistry.some((item) => item.code === this.activeLocale);
    if (!exists) this.activeLocale = this.defaultLocale;
  }

  // Effect 2: outside-click listener, gated on [isLocalizedField, isLocaleMenuOpen].
  @watch('isLocaleMenuOpen', 'field')
  private syncOutsideClickListener(): void {
    const shouldListen = this.isLocalizedField && this.isLocaleMenuOpen;
    if (shouldListen && !this.outsideClickAttached) {
      document.addEventListener('mousedown', this.onClickOutside);
      this.outsideClickAttached = true;
    } else if (!shouldListen && this.outsideClickAttached) {
      document.removeEventListener('mousedown', this.onClickOutside);
      this.outsideClickAttached = false;
    }
  }

  @bound private onClickOutside(event: MouseEvent): void {
    if (!this.localeMenuRef.current) return;
    if (!this.localeMenuRef.current.contains(event.target as Node)) {
      this.isLocaleMenuOpen = false;
    }
  }

  componentDidMount(): void {
    this.syncActiveLocale();
    this.syncOutsideClickListener();
  }

  componentWillUnmount(): void {
    if (this.outsideClickAttached) {
      document.removeEventListener('mousedown', this.onClickOutside);
      this.outsideClickAttached = false;
    }
  }

  private get label(): string {
    const { field } = this;
    return field.label || field.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  }

  private get fieldMarkedReadOnly(): boolean {
    return Boolean(this.field.admin?.readOnly);
  }

  private get readOnlyOverrideDisabled(): boolean {
    const { field } = this;
    return (
      field.admin?.readOnlyOverride === false ||
      field.admin?.readOnlyOverride === 'never' ||
      field.admin?.allowReadOnlyOverride === false
    );
  }

  private get supportsReadOnlyOverride(): boolean {
    return this.fieldMarkedReadOnly && !this.readOnlyOverrideDisabled;
  }

  private get isFieldReadOnly(): boolean {
    return Boolean(this.disabled || (this.fieldMarkedReadOnly && !this.readOnlyOverrideGranted));
  }

  private get canRequestReadOnlyOverride(): boolean {
    return Boolean(!this.disabled && this.supportsReadOnlyOverride && this.isFieldReadOnly && this.onReadOnlyOverrideRequest);
  }

  private get componentHandlesLocalization(): boolean {
    return this.isLocalizedField && Boolean(this.field.admin?.handlesLocalization);
  }

  private get localizedMap(): Record<string, any> | null {
    if (!this.isLocalizedField) return null;
    return this.localization.toLocaleMap(this.value, this.defaultLocale);
  }

  private get currentValue(): any {
    if (this.componentHandlesLocalization) return this.value;
    if (this.isLocalizedField) return this.localizedMap?.[this.activeLocale] ?? '';
    return this.value;
  }

  @bound private updateValue(nextValue: any): void {
    if (this.isFieldReadOnly) return;

    if (this.componentHandlesLocalization) {
      this.onChange(nextValue);
      return;
    }

    if (!this.isLocalizedField) {
      this.onChange(nextValue);
      return;
    }

    const nextMap = { ...(this.localizedMap || {}) };
    nextMap[this.activeLocale] = nextValue;
    this.onChange(nextMap);
  }

  @bound private requestReadOnlyOverride(): void {
    if (!this.canRequestReadOnlyOverride || !this.onReadOnlyOverrideRequest) return;
    this.onReadOnlyOverrideRequest({ name: this.field.name, label: this.label });
  }

  @bound private wrapWithReadOnlyOverride(node: ReactNode, roundedClass: string = 'rounded-lg'): ReactNode {
    if (!this.canRequestReadOnlyOverride) return node;
    return (
      <div className="relative">
        {node}
        <button
          type="button"
          onClick={this.requestReadOnlyOverride}
          className={`absolute inset-0 z-20 ${roundedClass} border border-indigo-400/50 bg-indigo-500/[0.03] hover:bg-indigo-500/[0.06] transition-colors`}
          title={`Override read-only field "${this.label}"`}
          aria-label={`Override read-only field ${this.label}`}
        />
      </div>
    );
  }

  private get shouldInlineLocaleSwitcher(): boolean {
    const { field } = this;
    return (
      this.isLocalizedField &&
      !this.componentHandlesLocalization &&
      !(
        field.type === 'relationship' ||
        field.type === 'select' ||
        field.type === 'boolean' ||
        field.type === 'checkbox' ||
        field.type === 'array' ||
        field.type === 'date' ||
        field.type === 'datetime' ||
        field.type === 'color' ||
        field.type === 'code' ||
        field.type === 'permalink' ||
        Boolean(field.admin?.component)
      )
    );
  }

  @bound private toggleLocaleMenu(): void {
    this.isLocaleMenuOpen = !this.isLocaleMenuOpen;
  }

  @bound private selectLocale(code: string): void {
    this.activeLocale = code;
    this.isLocaleMenuOpen = false;
  }

  @bound private localeSwitcher(compact: boolean = false): ReactNode {
    const localeRegistry = this.localeRegistry;
    const activeLocaleMeta = localeRegistry.find((item) => item.code === this.activeLocale) || localeRegistry[0];
    return (
      <FieldLocaleSwitcher
        compact={compact}
        theme={this.theme}
        activeLocale={this.activeLocale}
        activeLocaleCode={activeLocaleMeta?.code || this.activeLocale || 'en'}
        localeRegistry={localeRegistry}
        isOpen={this.isLocaleMenuOpen}
        onToggle={this.toggleLocaleMenu}
        onSelect={this.selectLocale}
        menuRef={this.localeMenuRef as RefObject<HTMLDivElement>}
      />
    );
  }

  render(): ReactElement {
    const fieldComponents = (this.plugins as any).fieldComponents || {};
    const isLocalizedField = this.isLocalizedField;
    const defaultLocale = this.defaultLocale;
    const currentValue = this.currentValue;
    const label = this.label;

    const resolvedCurrentText = FieldRendererUtils.resolveRenderableText(currentValue, this.activeLocale || defaultLocale);
    const resolvedFieldDescription = FieldRendererUtils.resolveRenderableText(this.field.admin?.description, this.activeLocale || defaultLocale);

    return (
      <div className={FieldRendererUtils.wrapperClassName(this.field, this.isFieldReadOnly, this.theme)}>
        <FieldRendererHeader
          field={this.field}
          label={label}
          theme={this.theme}
          isFieldReadOnly={this.isFieldReadOnly}
          supportsReadOnlyOverride={this.supportsReadOnlyOverride}
          readOnlyOverrideGranted={this.readOnlyOverrideGranted ?? false}
          canRequestReadOnlyOverride={this.canRequestReadOnlyOverride}
          isLocalizedField={isLocalizedField}
          componentHandlesLocalization={this.componentHandlesLocalization}
          shouldInlineLocaleSwitcher={this.shouldInlineLocaleSwitcher}
          onRequestReadOnlyOverride={this.requestReadOnlyOverride}
          localeSwitcher={this.localeSwitcher}
        />

        <FieldControlRenderer
          field={this.field}
          currentValue={currentValue}
          resolvedCurrentText={resolvedCurrentText}
          updateValue={this.updateValue}
          wrapWithReadOnlyOverride={this.wrapWithReadOnlyOverride}
          theme={this.theme}
          collectionSlug={this.collectionSlug}
          pluginSettings={this.pluginSettings}
          globalSettings={this.globalSettings}
          fieldComponents={fieldComponents}
          isFieldReadOnly={this.isFieldReadOnly}
          isNew={this.isNew ?? false}
          errors={this.errors}
          label={label}
          slugWarning={this.slugWarning}
          slugManuallyEdited={this.slugManuallyEdited}
          isLocalizedField={isLocalizedField}
          shouldInlineLocaleSwitcher={this.shouldInlineLocaleSwitcher}
          localeSwitcher={this.localeSwitcher}
          record={this.record}
          onPatch={this.onPatch}
        />

        <FieldRendererFooter
          field={this.field}
          resolvedFieldDescription={resolvedFieldDescription}
          errors={this.errors}
          provenance={this.provenance}
        />
      </div>
    );
  }
}
