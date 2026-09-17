import type { ReactNode, RefObject } from 'react';
import { bound, watch } from '@fromcode119/react-class-components';
import { AdminPathUtils } from '@/lib/admin-path';
import { FieldProvenance } from '@/lib/collection/field-provenance';
import { FieldLocaleSwitcher } from '@/components/collection/field-locale-switcher';
import { FieldRendererViewAccess } from '@/components/collection/field-renderer-view-access';

/**
 * Editing ONE locale of a localized field at a time.
 *
 * A localized value is a map keyed by locale, not a string, so every read and write here goes through
 * the active locale — writing the bare value would collapse every other translation the record has.
 * `provenance` belongs here for the same reason: where a value came FROM is a question about the
 * value being SHOWN, which is the active locale's.
 *
 * Some field components localize themselves; for those the switcher is handed over rather than drawn,
 * so a field never ends up with two of them.
 */
export abstract class FieldRendererViewLocale extends FieldRendererViewAccess {
  protected get isLocalizedField(): boolean {
    return Boolean(this.field.localized);
  }

  // Effect 1: reset activeLocale to defaultLocale when the current locale is not in the registry.
  // Original deps: [activeLocale, defaultLocale, isLocalizedField, localeRegistry] — mapped to a
  // `@watch` on the underlying state (activeLocale) + prop (field/plugins) drivers of those values.
  @watch('activeLocale', 'field', 'plugins')
  protected syncActiveLocale(): void {
    if (!this.isLocalizedField) return;
    const exists = this.localeRegistry.some((item) => item.code === this.activeLocale);
    if (!exists) this.activeLocale = this.defaultLocale;
  }

  // Effect 2: outside-click listener, gated on [isLocalizedField, isLocaleMenuOpen].
  @watch('isLocaleMenuOpen', 'field')
  protected syncOutsideClickListener(): void {
    const shouldListen = this.isLocalizedField && this.isLocaleMenuOpen;
    if (shouldListen && !this.outsideClickAttached) {
      document.addEventListener('mousedown', this.onClickOutside);
      this.outsideClickAttached = true;
    } else if (!shouldListen && this.outsideClickAttached) {
      document.removeEventListener('mousedown', this.onClickOutside);
      this.outsideClickAttached = false;
    }
  }

  @bound protected onClickOutside(event: MouseEvent): void {
    if (!this.localeMenuRef.current) return;
    if (!this.localeMenuRef.current.contains(event.target as Node)) {
      this.isLocaleMenuOpen = false;
    }
  }

  protected get componentHandlesLocalization(): boolean {
    return this.isLocalizedField && Boolean(this.field.admin?.handlesLocalization);
  }

  protected get localizedMap(): Record<string, any> | null {
    if (!this.isLocalizedField) return null;
    return this.localization.toLocaleMap(this.value, this.defaultLocale);
  }

  protected get currentValue(): any {
    if (this.componentHandlesLocalization) return this.value;
    if (this.isLocalizedField) return this.localizedMap?.[this.activeLocale] ?? '';
    return this.value;
  }

  @bound protected updateValue(nextValue: any): void {
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

  protected get shouldInlineLocaleSwitcher(): boolean {
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

  @bound protected toggleLocaleMenu(): void {
    this.isLocaleMenuOpen = !this.isLocaleMenuOpen;
  }

  @bound protected selectLocale(code: string): void {
    this.activeLocale = code;
    this.isLocaleMenuOpen = false;
  }

  /**
   * A render prop whose OUTPUT depends on `isLocaleMenuOpen` / `activeLocale`, so its identity must
   * change with them.
   *
   * As a stable `@bound` reference it never did, and every consumer down the chain
   * (FieldRendererHeader, FieldControlRenderer, FieldTextInput, FieldTextualControl) is a PureReactor.
   * Flipping the menu state re-rendered THIS component, the children saw shallow-equal props, their
   * subtrees were skipped, and the switcher kept rendering with the state it was first called with. The
   * button was live and the menu could never appear — indistinguishable from a dead control.
   */
  protected get localeSwitcherProp(): (compact?: boolean) => ReactNode {
    // Referenced so the closure identity changes with the state the switcher renders from.
    void this.isLocaleMenuOpen;
    void this.activeLocale;
    return (compact?: boolean) => this.localeSwitcher(compact ?? false);
  }

  @bound protected localeSwitcher(compact: boolean = false): ReactNode {
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

  /**
   * What the storefront actually uses for this field when the record leaves it empty, and which setting
   * decides it. Null unless the field declares `admin.fallback`, so nothing changes for fields that
   * simply mean what they say.
   */
  protected get provenance(): FieldProvenance | null {
    return FieldProvenance.resolve(
      this.field.admin?.fallback,
      this.currentValue,
      this.record ?? {},
      this.pluginSettings ?? {},
      this.pluginSlug ? AdminPathUtils.toAdminPath(`/plugins/${this.pluginSlug}/settings`) : '',
      this.pluginSettingsSchema,
    );
  }
}
