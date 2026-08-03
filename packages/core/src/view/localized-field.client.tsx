import type { CSSProperties, ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/reactor';
import { FieldLabelLayout } from '@core/enums/field-label-layout.enum';
import { UiScope } from '@core/enums/ui-scope.enum';
import { LocalizationUtils } from '@core/localization';
import { PublicSettings } from '@core/public-settings';
import { LocaleSwitcher } from '@core/localized-field/view/locale-switcher.client';
import { RuntimeSettingsMerge } from '@core/localized-field/runtime-settings-merge';

/**
 * Wraps any input in a locale selector, so one field edits per-locale values.
 *
 * The three sub-components (`LocaleSwitcher`, `GlobeIcon`, `ChevronIcon`) live in `./localized-field/`
 * — one class per file.
 *
 * **Why the styles are inline here and not in a stylesheet.** This component is re-exported to PLUGIN
 * and THEME bundles through the runtime bridge (`SdkExportSourceBuilder` / `BridgeObjectBuilder`), and
 * those bundles load with no import map and no guarantee that any stylesheet of core's is present —
 * core ships `dist` only and has no CSS pipeline. Extracting these to a `.css` would render the field
 * unstyled inside every plugin bundle. Giving core a CSS pipeline (and loading it from both hosts) is
 * the prerequisite for moving them out.
 */
export class LocalizedField extends Reactor {
  @prop declare label?: string;
  /** Render-prop receiving the currently selected locale code. */
  @prop declare input: (locale: string) => ReactNode;
  /** Defaults to admin scope. Pass 'frontend' for storefront/theme contexts. */
  @prop declare localeScope?: UiScope;
  /** Settings record (typically the runtime bridge's getState().settings or similar).
   * If omitted, the component reads from the runtime registry bridge at render-time. */
  @prop declare settings?: Record<string, unknown> | null;
  /** Display style: 'inline' (default) renders a chip button absolutely positioned
   * at top-right of the input, matching the admin UI. 'label-row' renders the
   * locale dropdown on its own row above the input. */
  @prop declare variant?: FieldLabelLayout;

  /** '' means "unset" — falls back to the resolved default via `currentLocale`. */
  @state private selectedLocale = '';

  private static readonly COLUMN_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };

  private static readonly LABEL_ROW_STYLE: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  };

  private static readonly LABEL_STYLE: CSSProperties = { fontSize: 11, fontWeight: 600, color: '#334155' };

  private static readonly INLINE_WRAPPER_STYLE: CSSProperties = { position: 'relative' };

  private static readonly INLINE_CHIP_STYLE: CSSProperties = { position: 'absolute', top: 6, right: 6, zIndex: 5 };

  componentDidMount(): void {
    // Re-render when the lazily-loaded public settings arrive (replaces PublicSettings.useSettings()).
    this.subscribe((onChange) => PublicSettings.subscribe(onChange));
    if (!PublicSettings.getAll()) PublicSettings.ensureLoaded();
  }

  private get scope(): UiScope { return UiScope.resolve(this.localeScope ?? UiScope.ADMIN); }

  private get variantMode(): FieldLabelLayout { return FieldLabelLayout.resolve(this.variant ?? FieldLabelLayout.INLINE); }

  private get resolvedSettings(): Record<string, unknown> | null {
    return this.settings ?? RuntimeSettingsMerge.apply(PublicSettings.getAll());
  }

  private get registry(): Array<{ code: string; label: string }> {
    return LocalizationUtils.parseLocaleRegistry(this.resolvedSettings);
  }

  private get defaultLocale(): string {
    return this.scope === UiScope.FRONTEND
      ? LocalizationUtils.resolveFrontendLocale(this.resolvedSettings, this.registry)
      : LocalizationUtils.resolveAdminLocale(this.resolvedSettings, this.registry);
  }

  /** Reconciles the selected locale against the registry (equivalent to the old useEffect):
   *  empty registry or a selection no longer present → fall back to the default locale. */
  private get currentLocale(): string {
    const registry = this.registry;
    if (!registry.length) return this.defaultLocale;
    if (!registry.some((entry) => entry.code === this.selectedLocale)) return this.defaultLocale;
    return this.selectedLocale;
  }

  private get showSwitcher(): boolean {
    return this.registry.length > 1;
  }

  @bound
  protected onLocaleChange(next: string): void {
    this.selectedLocale = next;
  }

  private switcher(activeLocale: string): ReactNode {
    return <LocaleSwitcher registry={this.registry} active={activeLocale} onChange={this.onLocaleChange} />;
  }

  render(): ReactNode {
    const activeLocale = this.currentLocale;
    const showSwitcher = this.showSwitcher;

    if (this.variantMode === FieldLabelLayout.LABEL_ROW) {
      return (
        <div style={LocalizedField.COLUMN_STYLE}>
          {(this.label || showSwitcher) && (
            <div style={LocalizedField.LABEL_ROW_STYLE}>
              {this.label ? <span style={LocalizedField.LABEL_STYLE}>{this.label}</span> : <span />}
              {showSwitcher ? this.switcher(activeLocale) : null}
            </div>
          )}
          {this.input(activeLocale)}
        </div>
      );
    }

    // Inline variant: chip floats over the top-right corner of the input.
    return (
      <div style={LocalizedField.COLUMN_STYLE}>
        {this.label ? <span style={LocalizedField.LABEL_STYLE}>{this.label}</span> : null}
        <div className="fc-localized-field-inline" style={LocalizedField.INLINE_WRAPPER_STYLE}>
          {this.input(activeLocale)}
          {showSwitcher ? (
            <div style={LocalizedField.INLINE_CHIP_STYLE}>{this.switcher(activeLocale)}</div>
          ) : null}
        </div>
      </div>
    );
  }
}
