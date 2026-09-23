import { NotificationType } from '@/components/enums/notification-type.enum';
import { bound } from '@fromcode119/react-class-components';
import { ContextBridge } from '@fromcode119/react';
import { LocalizationSettingsIo } from '@/app/settings/localization/localization-settings-io';
import { LocalizationSettingsPageState } from '@/app/settings/localization/page-state.client';

/**
 * Reading the localization settings and writing them back.
 */
export abstract class LocalizationSettingsPageActions extends LocalizationSettingsPageState {
  protected async loadLocalization(): Promise<void> {
    this.loadError = null;
    try {
      const loaded = await LocalizationSettingsIo.load();
      this.locales = loaded.locales;
      this.defaultLocale = loaded.defaultLocale;
      this.adminDefaultLocale = loaded.adminDefaultLocale;
      this.frontendDefaultLocale = loaded.frontendDefaultLocale;
      this.localeUrlStrategy = loaded.localeUrlStrategy;
      this.measurementSystem = loaded.measurementSystem;
      this.country = loaded.country;
    } catch (err: any) {
      this.locales = null;
      this.loadError = err?.message || 'The localization settings request failed.';
    } finally {
      this.isLoading = false;
    }
  }

  protected get registerSettings(): (settings: Record<string, any>) => void {
    const plugins = this.runtime?.plugins;
    if (plugins?.registerSettings) return plugins.registerSettings.bind(plugins);
    return ContextBridge.registerSettings.bind(ContextBridge);
  }

  @bound
  async retryLoad(): Promise<void> {
    this.isLoading = true;
    await this.loadLocalization();
  }

  @bound
  async handleSave(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    const locales = this.locales;
    // Fail closed: never PUT a locale registry that was not read back from the server. The Save control
    // is not rendered in this state.
    if (!locales) return;
    this.isSaving = true;
    try {
      const cleaned = LocalizationSettingsIo.cleanLocales(locales);

      if (!cleaned.length) {
        addNotification({
          title: 'Invalid Locale List',
          message: 'Add at least one locale with a valid ISO code.',
          type: NotificationType.ERROR
        });
        return;
      }

      const saved = await LocalizationSettingsIo.save(
        cleaned,
        {
          defaultLocale: this.defaultLocale,
          adminDefaultLocale: this.adminDefaultLocale,
          frontendDefaultLocale: this.frontendDefaultLocale
        },
        this.localeUrlStrategy,
        this.measurementSystem,
        this.country,
      );

      this.locales = saved.cleaned;
      this.defaultLocale = saved.defaultLocale;
      this.adminDefaultLocale = saved.adminDefaultLocale;
      this.frontendDefaultLocale = saved.frontendDefaultLocale;

      this.registerSettings({
        localization_locales: JSON.stringify(saved.cleaned.map(({ id, ...rest }) => rest)),
        enabled_locales: saved.enabledCodes.join(','),
        default_locale: saved.defaultLocale,
        admin_default_locale: saved.adminDefaultLocale,
        frontend_default_locale: saved.frontendDefaultLocale,
        // `.value`, not the Enum instance: every consumer of the settings context reads a plain string,
        // so `settings.locale_url_strategy === 'path'` against a member object is permanently false and
        // an Enum reaching JSX renders as `[object Object]`.
        locale_url_strategy: this.localeUrlStrategy.value,
        measurement_system: this.measurementSystem.value,
        country: this.country
      });

      addNotification({
        title: 'Localization Updated',
        message: 'Locale registry and defaults have been saved.',
        type: NotificationType.SUCCESS
      });
    } catch (error: any) {
      addNotification({
        title: 'Save Failed',
        message: error?.message || 'Failed to save localization settings.',
        type: NotificationType.ERROR
      });
    } finally {
      this.isSaving = false;
    }
  }
}
