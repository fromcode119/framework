import { MeasurementSystem } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode, SetStateAction } from 'react';
import { state, bound } from '@fromcode119/reactor';
import { ContextBridge } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { LocalizationSettingsIo } from '@/app/settings/localization/localization-settings-io';
import { LocaleRegistryCard } from '@/app/settings/localization/locale-registry-card';
import { LocaleTargetsCard } from '@/app/settings/localization/locale-targets-card';
import { MeasurementSystemCard } from '@/app/settings/localization/measurement-system-card';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { ILocaleItem } from '@/app/settings/localization/interfaces/locale-item.interface';
import { LocaleUrlStrategy } from '@fromcode119/core/client';

export class LocalizationSettingsPage extends AdminComponent {
  private static readonly FALLBACK_LOCALES: ILocaleItem[] = [
    { id: 'en', code: 'en', name: 'English', enabled: true }
  ];

  @state isLoading = true;
  @state isSaving = false;
  @state locales: ILocaleItem[] = LocalizationSettingsPage.FALLBACK_LOCALES;
  @state defaultLocale = 'en';
  @state adminDefaultLocale = 'en';
  @state frontendDefaultLocale = 'en';
  @state localeUrlStrategy: LocaleUrlStrategy = LocaleUrlStrategy.QUERY;
  @state measurementSystem: MeasurementSystem = MeasurementSystem.METRIC;

  async componentDidMount(): Promise<void> {
    try {
      const loaded = await LocalizationSettingsIo.load();
      this.locales = loaded.locales;
      this.defaultLocale = loaded.defaultLocale;
      this.adminDefaultLocale = loaded.adminDefaultLocale;
      this.frontendDefaultLocale = loaded.frontendDefaultLocale;
      this.localeUrlStrategy = loaded.localeUrlStrategy;
      const all = await AdminSystemSettingsClient.getAll().catch(() => ({} as Record<string, any>));
      this.measurementSystem = MeasurementSystem.resolve(all?.measurement_system);
    } finally {
      this.isLoading = false;
    }
  }

  private get registerSettings(): (settings: Record<string, any>) => void {
    const plugins = this.runtime?.plugins;
    if (plugins?.registerSettings) return plugins.registerSettings.bind(plugins);
    return ContextBridge.registerSettings.bind(ContextBridge);
  }

  private get localeSelectOptions(): { value: string; label: string }[] {
    return LocalizationSettingsIo.buildSelectOptions(this.locales);
  }

  @bound
  updateLocale(id: string, patch: Partial<ILocaleItem>): void {
    this.locales = this.locales.map((locale) => (locale.id === id ? { ...locale, ...patch } : locale));
  }

  @bound
  addLocale(): void {
    const tempId = `locale-${Date.now()}`;
    this.locales = [
      ...this.locales,
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
    if (this.locales.length <= 1) return;
    this.locales = this.locales.filter((locale) => locale.id !== id);
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

  @bound
  async handleSave(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.isSaving = true;
    try {
      const cleaned = LocalizationSettingsIo.cleanLocales(this.locales);

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
        locale_url_strategy: this.localeUrlStrategy,
        measurement_system: this.measurementSystem
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

  render(): ReactNode {
    if (this.isLoading) {
      return (
        <div className="p-12">
          <Loader label="Loading Localization Matrix..." />
        </div>
      );
    }

    const theme = this.theme;

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Globe size={18} strokeWidth={2} />}
          title="Localization"
          subtitle="Locale registry & language defaults"
          actions={
            <Button
              icon={<FrameworkIcons.Save size={15} strokeWidth={2} />}
              onClick={this.handleSave}
              isLoading={this.isSaving}
              className="h-9 px-4 rounded-lg font-semibold text-xs text-white"
            >
              Save Localization
            </Button>
          }
        />

        <div className="p-6 w-full space-y-8">
          <LocaleRegistryCard
            locales={this.locales}
            theme={theme}
            updateLocale={this.updateLocale}
            addLocale={this.addLocale}
            removeLocale={this.removeLocale}
          />

          <LocaleTargetsCard
            theme={theme}
            localeSelectOptions={this.localeSelectOptions}
            defaultLocale={this.defaultLocale}
            setDefaultLocale={this.setDefaultLocale}
            adminDefaultLocale={this.adminDefaultLocale}
            setAdminDefaultLocale={this.setAdminDefaultLocale}
            frontendDefaultLocale={this.frontendDefaultLocale}
            setFrontendDefaultLocale={this.setFrontendDefaultLocale}
            localeUrlStrategy={this.localeUrlStrategy}
            setLocaleUrlStrategy={this.setLocaleUrlStrategy}
          />

          <MeasurementSystemCard
            theme={theme}
            measurementSystem={this.measurementSystem}
            setMeasurementSystem={this.setMeasurementSystem}
          />
        </div>
      </div>
    );
  }
}
