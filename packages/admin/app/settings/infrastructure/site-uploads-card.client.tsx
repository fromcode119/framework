import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { SystemConstants } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Button } from '@/components/ui/view/button.client';
import { SettingRow } from '@/app/settings/general/setting-row';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';

/**
 * What a SITE may store in themes it uploads itself.
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
  @state loaded = false;
  @state saving = false;

  async componentDidMount(): Promise<void> {
    try {
      const settings = await AdminSystemSettingsClient.getAll();
      const bytes = Number(settings?.[SystemConstants.META_KEY.TENANT_THEME_MAX_BYTES]);
      this.themeMaxMb = bytes > 0 ? String(Math.round((bytes / SiteUploadsCard.BYTES_PER_MB) * 10) / 10) : '';
      this.themeMaxCount = String(settings?.[SystemConstants.META_KEY.TENANT_THEME_MAX_COUNT] ?? '');
      this.loaded = true;
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, 'Site Upload Limits Unavailable', err?.message || 'The limits could not be read.');
    }
  }

  @bound onThemeMaxMb(value: number | string): void { this.themeMaxMb = String(value); }
  @bound onThemeMaxCount(value: number | string): void { this.themeMaxCount = String(value); }

  @bound
  async save(): Promise<void> {
    this.saving = true;
    try {
      const megabytes = Number(this.themeMaxMb);
      await AdminSystemSettingsClient.update({
        [SystemConstants.META_KEY.TENANT_THEME_MAX_BYTES]: megabytes > 0 ? String(Math.round(megabytes * SiteUploadsCard.BYTES_PER_MB)) : '',
        [SystemConstants.META_KEY.TENANT_THEME_MAX_COUNT]: this.themeMaxCount,
      });
      this.runtime.notify.notify(NotificationType.SUCCESS, 'Saved', 'The site upload limits apply to the next upload.');
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, 'Not Saved', err?.message || 'The limits could not be saved.');
    } finally {
      this.saving = false;
    }
  }

  render(): ReactNode {
    const theme = this.theme;
    return (
      <Card title="Site Uploads">
        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Database}
          title="Space for a site's own themes (MB)"
          stacked
          description="The most one site may store in themes it uploaded itself, all of them together. Every site's uploads share one volume on this server, so this protects the other sites. A theme being replaced does not count twice."
        >
          <div className="w-full md:w-40">
            <NumberStepper min={1} step={5} value={this.themeMaxMb} onChange={this.onThemeMaxMb} disabled={!this.loaded} placeholder={`Default ${SystemConstants.TENANT_THEME_MAX_MB_DEFAULT}`} />
          </div>
        </SettingRow>
        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Layers}
          title="Themes per site"
          stacked
          description="How many of its own themes a site may keep. Themes the platform assigns to a site do not count."
        >
          <div className="flex items-center gap-3">
            <div className="w-full md:w-40">
              <NumberStepper min={1} step={1} value={this.themeMaxCount} onChange={this.onThemeMaxCount} disabled={!this.loaded} placeholder={`Default ${SystemConstants.TENANT_THEME_MAX_COUNT_DEFAULT}`} />
            </div>
            <Button onClick={this.save} isLoading={this.saving} disabled={!this.loaded} icon={<FrameworkIcons.Save size={13} />} className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight">
              Save
            </Button>
          </div>
        </SettingRow>
      </Card>
    );
  }
}
