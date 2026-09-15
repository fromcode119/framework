import { ThemeMode } from '@fromcode119/core/client';
import { SystemConstants } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { PersonalDataPolicyClient } from '@/lib/settings/personal-data-policy-client';
import { PersonalDataPolicyRow } from '@/app/settings/personal-data/personal-data-policy-row';
import type { IPersonalDataPolicyChoice } from '@/app/settings/personal-data/interfaces/personal-data-policy-choice.interface';
import type { IPersonalDataChoiceMap } from '@/app/settings/personal-data/interfaces/personal-data-choice-map.interface';
import type { IPersonalDataPolicyDataset } from '@/app/settings/personal-data/interfaces/personal-data-policy-dataset.interface';

/**
 * What the platform does with a person's data when they ask to be forgotten.
 *
 * Every dataset on this screen is DECLARED AT RUNTIME — seven by the framework, the rest by whichever
 * plugins this site runs — so the list can never name something nothing holds, and a strategy is
 * never offered that its owner refused to support. The same answer drives a self-delete and a DSAR:
 * this policy used to live in a compliance plugin, so core could not read it and the two doors gave
 * the same person different outcomes.
 */
export class PersonalDataSettingsPage extends AdminComponent {
  @state isLoading = true;
  @state isSaving = false;
  @state loadError: string | null = null;
  /** `null` means NEVER LOADED — never an empty list, which would claim this platform holds nothing. */
  @state datasets: IPersonalDataPolicyDataset[] | null = null;
  @state site: IPersonalDataChoiceMap = {};
  @state platform: IPersonalDataChoiceMap = {};
  /** Whether THIS account may write each layer. The API refuses either way; the page must not pretend. */
  @state platformEditable = false;
  @state siteEditable = false;
  /**
   * Whether each layer HAD a stored row when the page loaded.
   *
   * Saving used to send both maps unconditionally, so a platform admin who touched only the site
   * column still wrote `personal_data_erasure_defaults = {}` — a stored row asserting nothing, which
   * is exactly the kind of value nobody chose that this codebase refuses to keep. An empty map is
   * still sent when one WAS stored, because that is how an operator clears every choice.
   */
  private hadSite = false;
  private hadPlatform = false;

  async componentDidMount() {
    await this.load();
  }

  @bound
  private async load(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    try {
      const [policy, settings, platformKeys] = await Promise.all([
        PersonalDataPolicyClient.get(),
        AdminSystemSettingsClient.getAll(),
        PersonalDataPolicyClient.platformKeys(),
      ]);
      this.datasets = PersonalDataPolicyClient.toDatasets(policy);
      this.site = PersonalDataPolicyClient.toChoiceMap(settings?.[SystemConstants.META_KEY.PERSONAL_DATA_ERASURE_STRATEGIES]);
      this.platform = PersonalDataPolicyClient.toChoiceMap(settings?.[SystemConstants.META_KEY.PERSONAL_DATA_ERASURE_DEFAULTS]);
      this.hadSite = Object.keys(this.site).length > 0;
      this.hadPlatform = Object.keys(this.platform).length > 0;
      this.platformEditable = Boolean(platformKeys?.editable);
      // With no site chosen the settings PUT refuses any per-site key outright, so the site column is
      // shown as read-only rather than offering an edit that cannot be saved.
      this.siteEditable = Boolean(platformKeys?.siteSelected);
    } catch (error: any) {
      this.loadError = error?.message || 'Unknown error';
    } finally {
      this.isLoading = false;
    }
  }

  @bound
  private onSiteChange(id: string, choice: IPersonalDataPolicyChoice | undefined): void {
    this.site = PersonalDataPolicyClient.withChoice(this.site, id, choice);
  }

  @bound
  private onPlatformChange(id: string, choice: IPersonalDataPolicyChoice | undefined): void {
    this.platform = PersonalDataPolicyClient.withChoice(this.platform, id, choice);
  }

  /**
   * Saves only the layers this account may write, then RELOADS the resolved policy — what is in force
   * is computed by the same code the erasure runs, so the "in force now" column can never drift from
   * what would actually happen.
   */
  @bound
  private async save(): Promise<void> {
    this.isSaving = true;
    try {
      const payload: Record<string, unknown> = {};
      if (this.siteEditable && (this.hadSite || Object.keys(this.site).length > 0)) {
        payload[SystemConstants.META_KEY.PERSONAL_DATA_ERASURE_STRATEGIES] = this.site;
      }
      if (this.platformEditable && (this.hadPlatform || Object.keys(this.platform).length > 0)) {
        payload[SystemConstants.META_KEY.PERSONAL_DATA_ERASURE_DEFAULTS] = this.platform;
      }
      if (Object.keys(payload).length === 0) return;
      await AdminSystemSettingsClient.update(payload);
      await this.load();
      this.runtime.notify.addNotification({
        title: 'Erasure policy saved', message: 'The new policy applies to every erasure from now on.', type: NotificationType.INFO,
      });
    } catch (error: any) {
      this.runtime.notify.addNotification({
        title: 'Error', message: error?.message || 'Could not save the erasure policy.', type: NotificationType.ERROR,
      });
    } finally {
      this.isSaving = false;
    }
  }

  render(): ReactNode {
    const theme = this.theme;
    const isDark = theme === ThemeMode.DARK;

    if (this.isLoading) return <Loader />;

    return (
      <div className="p-6 animate-in fade-in duration-500 w-full">
        <div className="mb-6">
          <h1 className={`text-2xl font-bold tracking-tight mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Personal data
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            What happens to each dataset when somebody asks to be forgotten. A site answers for the data it
            controls; the platform default applies wherever a site has said nothing.
          </p>
        </div>

        {this.loadError && (
          <LoadErrorPanel
            title="The erasure policy could not be loaded"
            message={this.loadError}
            onRetry={this.load}
            isRetrying={this.isLoading}
          />
        )}

        {this.datasets && (
          <Card title="Erasure strategy per dataset">
            <div className={`hidden md:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 pb-2 text-[12px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span>Dataset</span>
              <span>Platform default</span>
              <span>This site</span>
              <span>In force now</span>
            </div>

            {this.datasets.map((dataset) => (
              <PersonalDataPolicyRow
                key={dataset.id}
                dataset={dataset}
                site={this.site[dataset.id]}
                platform={this.platform[dataset.id]}
                platformEditable={this.platformEditable}
                siteEditable={this.siteEditable}
                onSiteChange={this.onSiteChange}
                onPlatformChange={this.onPlatformChange}
                theme={theme}
              />
            ))}

            <div className="pt-4 flex items-center gap-3">
              <Button onClick={this.save} disabled={this.isSaving || (!this.siteEditable && !this.platformEditable)}>
                {this.isSaving ? 'Saving…' : 'Save policy'}
              </Button>
              {!this.platformEditable && (
                <span className={`text-[12px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  The platform default is set by a platform administrator.
                </span>
              )}
            </div>
          </Card>
        )}
      </div>
    );
  }
}
