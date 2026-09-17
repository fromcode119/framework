import { MeasurementSystem } from '@fromcode119/core/client';
import type { SetStateAction } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { LocalizationSettingsIo } from '@/app/settings/localization/localization-settings-io';
import { ILocaleItem } from '@/app/settings/localization/interfaces/locale-item.interface';
import { LocaleUrlStrategy } from '@fromcode119/core/client';
import { SettingsPageScope } from '@/lib/settings/settings-page-scope';

/**
 * Which locales this platform serves, and which one each surface defaults to.
 *
 * The base of this page's chain — the load and save, then the markup.
 *
 * Admin and storefront carry SEPARATE defaults on purpose: the people running a shop and the people
 * buying from it are rarely the same audience, and one shared default silently makes them so.
 */
export abstract class LocalizationSettingsPageState extends AdminComponent {
  @state isLoading = true;
  @state isSaving = false;
  /**
   * `null` means NEVER LOADED — it is not an empty registry.
   *
   * This used to be seeded with a hardcoded `English (en)` row, and `componentDidMount` had
   * `try/finally` with no `catch`, so a failed settings GET rendered English as a configured locale
   * and "Save Localization" would then write `en` as the platform's ONLY locale — destroying a
   * multi-locale configuration on the strength of a transient API failure.
   */
  @state locales: ILocaleItem[] | null = null;
  @state loadError: string | null = null;
  @state defaultLocale = '';
  @state adminDefaultLocale = '';
  @state frontendDefaultLocale = '';
  @state localeUrlStrategy: LocaleUrlStrategy = LocaleUrlStrategy.QUERY;
  @state measurementSystem: MeasurementSystem = MeasurementSystem.METRIC;
  /**
   * Every key this screen writes is per-site, so in the platform scope the API refuses the save and
   * the whole locale table edit is lost. Null until the answer arrives; nothing is hidden before then.
   */
  @state scope: SettingsPageScope | null = null;

  /** The keys `LocalizationSettingsIo.save` PUTs — the one list this page's scope is judged on. */
  protected static readonly KEYS = [
    'localization_locales', 'enabled_locales', 'default_locale', 'admin_default_locale',
    'frontend_default_locale', 'locale_url_strategy', 'measurement_system',
  ] as const;

  protected get localeSelectOptions(): { value: string; label: string }[] {
    return LocalizationSettingsIo.buildSelectOptions(this.locales ?? []);
  }

  @bound
  updateLocale(id: string, patch: Partial<ILocaleItem>): void {
    const locales = this.locales;
    if (!locales) return;
    this.locales = locales.map((locale) => (locale.id === id ? { ...locale, ...patch } : locale));
  }

  @bound
  addLocale(): void {
    const locales = this.locales;
    if (!locales) return;
    const tempId = `locale-${Date.now()}`;
    this.locales = [
      ...locales,
      {
        id: tempId,
        code: '',
        name: '',
        enabled: true
      }
    ];
  }

  @bound
  removeLocale(id: string): void {
    const locales = this.locales;
    if (!locales) return;
    this.locales = locales.filter((locale) => locale.id !== id);
  }

  @bound
  setDefaultLocale(value: string): void {
    this.defaultLocale = value;
  }

  @bound
  setAdminDefaultLocale(value: string): void {
    this.adminDefaultLocale = value;
  }

  @bound
  setFrontendDefaultLocale(value: string): void {
    this.frontendDefaultLocale = value;
  }

  @bound
  setLocaleUrlStrategy(update: SetStateAction<LocaleUrlStrategy>): void {
    this.localeUrlStrategy = typeof update === 'function'
      ? (update as (prev: LocaleUrlStrategy) => LocaleUrlStrategy)(this.localeUrlStrategy)
      : update;
  }

  @bound
  setMeasurementSystem(value: MeasurementSystem): void {
    this.measurementSystem = value;
  }

  protected get outOfScope(): boolean {
    return this.scope?.isEmpty === true;
  }
}
