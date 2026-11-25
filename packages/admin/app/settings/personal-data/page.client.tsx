import { SystemConstants } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { Card } from '@/components/ui/view/card.client';
import { Hint } from '@/components/ui/view/hint.client';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import { PendingSavesBar } from '@/components/ui/view/pending-saves-bar.client';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { PersonalDataPolicyClient } from '@/lib/settings/personal-data-policy-client';
import { PersonalDataPolicyRow } from '@/app/settings/personal-data/personal-data-policy-row';
import type { IPersonalDataPolicyChoice } from '@/app/settings/personal-data/interfaces/personal-data-policy-choice.interface';
import type { IPersonalDataChoiceMap } from '@/app/settings/personal-data/interfaces/personal-data-choice-map.interface';
import type { IPersonalDataPolicyDataset } from '@/app/settings/personal-data/interfaces/personal-data-policy-dataset.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { FrameworkIcons } from '@fromcode119/react';

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
  @state loadError: string | null = null;
  /** `null` means NEVER LOADED — never an empty list, which would claim this platform holds nothing. */
  @state datasets: IPersonalDataPolicyDataset[] | null = null;
  @state site: IPersonalDataChoiceMap = {};
  @state platform: IPersonalDataChoiceMap = {};
  /** Whether THIS account may write each layer. The API refuses either way; the page must not pretend. */
  @state platformEditable = false;
  /** Inside a site the platform's default is not shown: a site is a client and sees only its own policy. */
  @state inSite = false;
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

  /** What the page's one save bar reads and writes; made once the page is mounted. */
  private pending: PendingSave | null = null;

  async componentDidMount() {
    this.pending = new PendingSave(
      () => ({ site: this.site, platform: this.platform }),
      () => this.save(),
      (values) => { this.site = values.site; this.platform = values.platform; },
    );
    await this.load();
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.pending?.dispose();
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
      // WHO may write a platform key is not WHERE that control belongs. `editable` answers only the
      // first, so inside a site the PLATFORM column stayed editable — and its value is the default
      // every OTHER site inherits, changed from a console headed with one site's name. Same rule the
      // settings screens apply through `SettingsPageScope.sendable`: shown is not sendable, and a
      // platform control lives in the platform scope. Read-only here, not hidden, because the site
      // column is read against it and hiding it would make the inherited value unexplainable.
      const inSite = platformKeys?.tenantMode === true && platformKeys?.siteSelected !== false;
      this.inSite = inSite;
      this.platformEditable = Boolean(platformKeys?.editable) && !inSite;
      // With no site chosen on a multi-site deployment the settings PUT refuses any per-site key, so
      // the site column is read-only there. A single-site deployment has no such scope: its one site's
      // row is always the one written (the rule `PlatformSettingLocks` applies to every settings page).
      this.siteEditable = platformKeys?.tenantMode !== true || platformKeys?.siteSelected !== false;
      this.pending?.mark();
    } catch (error: any) {
      this.loadError = error?.message || AdminI18n.t('settings.personalData.unknownError');
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
        title: AdminI18n.t('settings.personalData.erasurePolicySaved'), message: AdminI18n.t('settings.personalData.theNewPolicyAppliesTo'), type: NotificationType.INFO,
      });
    } catch (error: any) {
      this.pending?.failed();
      this.runtime.notify.addNotification({
        title: AdminI18n.t('settings.personalData.error'), message: error?.message || AdminI18n.t('settings.personalData.couldNotSaveTheErasure'), type: NotificationType.ERROR,
      });
    }
  }

  render(): ReactNode {
    if (this.isLoading) return <Loader />;

    return (
      <div className="flex h-full flex-col animate-in fade-in duration-500">
        <CompactPageHeader icon={<FrameworkIcons.ShieldCheck size={18} strokeWidth={2} />} title={AdminI18n.t('settings.personalData.personalData')} subtitle={AdminI18n.t('settings.personalData.whatHappensToEachDataset')} />
        <div className="w-full py-6">

        {this.loadError && (
          <LoadErrorPanel
            title={AdminI18n.t('settings.personalData.theErasurePolicyCouldNot')}
            message={this.loadError}
            onRetry={this.load}
            isRetrying={this.isLoading}
          />
        )}

        {this.datasets && (
          <Card title={AdminI18n.t('settings.personalData.erasureStrategyPerDataset')}>
            <div className={this.inSite ? 'fc-pd fc-pd--site' : 'fc-pd'}>
              <div className="fc-pd__grid fc-pd__head">
                <span>{AdminI18n.t('settings.personalData.dataset')}</span>
                {!this.inSite && <span>{AdminI18n.t('settings.personalData.platformDefault')}</span>}
                <span>{AdminI18n.t('settings.personalData.thisSite')}</span>
                <span>{AdminI18n.t('settings.personalData.inForceNow')}</span>
              </div>
              {this.datasets.map((dataset) => (
                <PersonalDataPolicyRow
                  key={dataset.id}
                  dataset={dataset}
                  site={this.site[dataset.id]}
                  platform={this.platform[dataset.id]}
                  platformEditable={this.platformEditable}
                  showPlatform={!this.inSite}
                  siteEditable={this.siteEditable}
                  onSiteChange={this.onSiteChange}
                  onPlatformChange={this.onPlatformChange}
                  theme={this.theme}
                />
              ))}
            </div>

            {!this.platformEditable && !this.inSite ? (
              <div className="fc-settings-note">
                <Hint>{AdminI18n.t('settings.personalData.thePlatformDefaultIsSet')}</Hint>
              </div>
            ) : null}
            {/* The site column is read-only in the platform scope, where the API refuses a per-site key. */}
            {!this.siteEditable ? (
              <div className="fc-settings-note">
                <Hint>{AdminI18n.t('settings.personalData.theSiteColumnIsSet')}</Hint>
              </div>
            ) : null}
          </Card>
        )}
        </div>
        <PendingSavesBar />
      </div>
    );
  }
}
