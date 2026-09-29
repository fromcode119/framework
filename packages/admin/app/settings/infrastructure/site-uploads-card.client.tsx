import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { SystemConstants } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Button } from '@/components/ui/view/button.client';
import { Switch } from '@/components/ui/view/switch.client';
import { SettingRow } from '@/app/settings/general/setting-row';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What a SITE may upload itself: themes, and — only once the platform switches it on — plugins.
 *
 * The limit is the platform's, not the site's: every site's uploads share one volume on the box, so a
 * site choosing its own ceiling would be no ceiling at all. The fields are empty until the platform
 * sets a value, and each names the declared default it then resolves to.
 *
 * Megabytes on screen, bytes in storage — the stored key is what the upload check reads.
 */
export class SiteUploadsCard extends AdminComponent {
  private static readonly BYTES_PER_MB = 1024 * 1024;

  @state themeMaxMb = '';
  @state themeMaxCount = '';
  @state pluginsEnabled = false;
  @state pluginMaxMb = '';
  @state pluginMaxCount = '';
  @state loaded = false;
  @state saving = false;

  async componentDidMount(): Promise<void> {
    try {
      const settings = await AdminSystemSettingsClient.getAll();
      this.themeMaxMb = SiteUploadsCard.toMegabytes(settings?.[SystemConstants.META_KEY.TENANT_THEME_MAX_BYTES]);
      this.themeMaxCount = String(settings?.[SystemConstants.META_KEY.TENANT_THEME_MAX_COUNT] ?? '');
      const enabled = settings?.[SystemConstants.META_KEY.TENANT_PLUGIN_UPLOADS_ENABLED];
      this.pluginsEnabled = enabled === true || enabled === 'true';
      this.pluginMaxMb = SiteUploadsCard.toMegabytes(settings?.[SystemConstants.META_KEY.TENANT_PLUGIN_MAX_BYTES]);
      this.pluginMaxCount = String(settings?.[SystemConstants.META_KEY.TENANT_PLUGIN_MAX_COUNT] ?? '');
      this.loaded = true;
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.siteUploadLimitsUnavailable'), err?.message || AdminI18n.t('settings.infrastructure.theLimitsCouldNotBe'));
    }
  }

  @bound onThemeMaxMb(value: number | string): void { this.themeMaxMb = String(value); }
  @bound onThemeMaxCount(value: number | string): void { this.themeMaxCount = String(value); }
  @bound onPluginsEnabled(value: boolean): void { this.pluginsEnabled = value; }
  @bound onPluginMaxMb(value: number | string): void { this.pluginMaxMb = String(value); }
  @bound onPluginMaxCount(value: number | string): void { this.pluginMaxCount = String(value); }

  private static toMegabytes(raw: unknown): string {
    const bytes = Number(raw);
    return bytes > 0 ? String(Math.round((bytes / SiteUploadsCard.BYTES_PER_MB) * 10) / 10) : '';
  }

  private static toBytes(megabytes: string): string {
    const value = Number(megabytes);
    return value > 0 ? String(Math.round(value * SiteUploadsCard.BYTES_PER_MB)) : '';
  }

  @bound
  async save(): Promise<void> {
    this.saving = true;
    try {
      await AdminSystemSettingsClient.update({
        [SystemConstants.META_KEY.TENANT_THEME_MAX_BYTES]: SiteUploadsCard.toBytes(this.themeMaxMb),
        [SystemConstants.META_KEY.TENANT_THEME_MAX_COUNT]: this.themeMaxCount,
        [SystemConstants.META_KEY.TENANT_PLUGIN_UPLOADS_ENABLED]: this.pluginsEnabled,
        [SystemConstants.META_KEY.TENANT_PLUGIN_MAX_BYTES]: SiteUploadsCard.toBytes(this.pluginMaxMb),
        [SystemConstants.META_KEY.TENANT_PLUGIN_MAX_COUNT]: this.pluginMaxCount,
      });
      this.runtime.notify.notify(NotificationType.SUCCESS, AdminI18n.t('settings.infrastructure.saved'), AdminI18n.t('settings.infrastructure.theSiteUploadLimitsApply'));
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.notSaved'), err?.message || AdminI18n.t('settings.infrastructure.theLimitsCouldNotBe2'));
    } finally {
      this.saving = false;
    }
  }

  render(): ReactNode {
    const theme = this.theme;
    return (
      <Card title={AdminI18n.t('settings.infrastructure.siteUploads')}>
        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Database}
          title={AdminI18n.t('settings.infrastructure.spaceForASiteS')}
          stacked
          description={AdminI18n.t('settings.infrastructure.theMostOneSiteMay')}
        >
          <div className="w-full md:w-40">
            <NumberStepper min={1} step={5} value={this.themeMaxMb} onChange={this.onThemeMaxMb} disabled={!this.loaded} placeholder={AdminI18n.t('settings.infrastructure.default', { TENANT_THEME_MAX_MB_DEFAULT: SystemConstants.TENANT_THEME_MAX_MB_DEFAULT })} />
          </div>
        </SettingRow>
        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Layers}
          title={AdminI18n.t('settings.infrastructure.themesPerSite')}
          stacked
          description={AdminI18n.t('settings.infrastructure.howManyOfItsOwn')}
        >
          <div className="w-full md:w-40">
            <NumberStepper min={1} step={1} value={this.themeMaxCount} onChange={this.onThemeMaxCount} disabled={!this.loaded} placeholder={AdminI18n.t('settings.infrastructure.default2', { TENANT_THEME_MAX_COUNT_DEFAULT: SystemConstants.TENANT_THEME_MAX_COUNT_DEFAULT })} />
          </div>
        </SettingRow>
        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Shield}
          title={AdminI18n.t('settings.infrastructure.sitesMayUploadTheirOwn')}
          stacked
          description={AdminI18n.t('settings.infrastructure.offByDefaultWhenOn')}
        >
          <Switch checked={this.pluginsEnabled} onChange={this.onPluginsEnabled} disabled={!this.loaded} label={this.pluginsEnabled ? AdminI18n.t('settings.infrastructure.on') : AdminI18n.t('settings.infrastructure.off')} />
        </SettingRow>
        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Database}
          title={AdminI18n.t('settings.infrastructure.spaceForASiteS2')}
          stacked
          description={AdminI18n.t('settings.infrastructure.theMostOneSiteMay2')}
        >
          <div className="w-full md:w-40">
            <NumberStepper min={1} step={5} value={this.pluginMaxMb} onChange={this.onPluginMaxMb} disabled={!this.loaded} placeholder={AdminI18n.t('settings.infrastructure.default3', { TENANT_PLUGIN_MAX_MB_DEFAULT: SystemConstants.TENANT_PLUGIN_MAX_MB_DEFAULT })} />
          </div>
        </SettingRow>
        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Layers}
          title={AdminI18n.t('settings.infrastructure.pluginsPerSite')}
          stacked
          description={AdminI18n.t('settings.infrastructure.howManyOfItsOwn2')}
        >
          <div className="flex items-center gap-3">
            <div className="w-full md:w-40">
              <NumberStepper min={1} step={1} value={this.pluginMaxCount} onChange={this.onPluginMaxCount} disabled={!this.loaded} placeholder={AdminI18n.t('settings.infrastructure.default4', { TENANT_PLUGIN_MAX_COUNT_DEFAULT: SystemConstants.TENANT_PLUGIN_MAX_COUNT_DEFAULT })} />
            </div>
            <Button onClick={this.save} isLoading={this.saving} disabled={!this.loaded} icon={<FrameworkIcons.Save size={13} />} className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight">
              {AdminI18n.t('settings.infrastructure.save')}
            </Button>
          </div>
        </SettingRow>
      </Card>
    );
  }
}
