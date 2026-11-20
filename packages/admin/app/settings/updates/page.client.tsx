import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { PlatformOnlyPanel } from '@/components/view/platform-only-panel.client';
import { PlatformScopeGate } from '@/components/view/platform-scope-gate.client';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Loader } from '@/components/ui/view/loader.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { Alert } from '@/components/ui/view/alert.client';
import { Text } from '@/components/ui/view/text.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { AppEnv } from '@/lib/env';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { PendingReleaseList } from '@/app/settings/updates/pending-release-list.client';
import { SelfUpdatePanel } from '@/app/settings/updates/self-update-panel.client';
import { PluginAutoUpdatePanel } from '@/app/settings/updates/plugin-auto-update-panel.client';
import { PendingSavesBar } from '@/components/ui/view/pending-saves-bar.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class UpdatesPage extends AdminComponent {
  @state status: any = null;
  @state loading = true;
  @state updating = false;
  @state showConfirm = false;
  /**
   * Set when the registry check FAILED, or answered without a `latest`.
   *
   * "We could not check" used to render as "you are current": `latestVersion` fell back to the
   * installed version and the badge went green "Framework Up to Date". An unreachable registry now
   * says so and the badge stays neutral.
   */
  @state checkError: string | null = null;

  /** Updating replaces the platform's own code, under every site at once. */
  private get canManagePlatform(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user);
  }

  async componentDidMount(): Promise<void> {
    if (!this.canManagePlatform) {
      this.loading = false;
      return;
    }
    await this.fetchStatus();
  }

  private get notify(): (type: any, title: string, message: string) => void {
    return this.runtime.notify.notify;
  }

  private get installedVersion(): string {
    return String(this.status?.current || AppEnv.APP_VERSION || '').trim();
  }

  /** The registry's answer, or `''` when it did not give one. NEVER the installed version. */
  private get latestVersion(): string {
    return String(this.status?.latest ?? '').trim();
  }

  /** True only when the registry answered AND named a different version. */
  private get hasUpdate(): boolean {
    return Boolean(this.status?.hasUpdate && this.latestVersion && this.latestVersion !== this.installedVersion);
  }

  /**
   * Whether this installation can rewrite its own files. The API says so; it is not inferred here,
   * because the admin cannot see the filesystem the api runs on.
   */
  private get canApplyInPlace(): boolean {
    return this.status?.canApplyInPlace !== false;
  }

  /** True when we do not know what the latest version is — distinct from "you are up to date". */
  private get latestVersionUnknown(): boolean {
    return Boolean(this.checkError) || !this.latestVersion;
  }

  @bound
  async fetchStatus(refresh = false): Promise<void> {
    this.loading = true;
    this.checkError = null;
    try {
      const data = await AdminApi.get(`${AdminConstants.ENDPOINTS.SYSTEM.UPDATE_CHECK}${refresh === true ? '?refresh=1' : ''}`, { noDedupe: refresh === true });
      this.status = data;
    } catch (err: any) {
      const message = err?.message || AdminI18n.t('settings.updates.theFrameworkRegistryCouldNot');
      this.status = null;
      this.checkError = message;
      this.notify(NotificationType.ERROR, AdminI18n.t('settings.updates.updateCheckFailed'), message);
    } finally {
      this.loading = false;
    }
  }

  @bound
  takeStatus(check: any): void {
    this.status = check;
  }

  @bound
  async handleUpdate(): Promise<void> {
    this.updating = true;
    try {
      // An image installation is updated by its updater service, which takes no file backup.
      if (!this.status?.selfUpdate) this.notify(NotificationType.INFO, AdminI18n.t('settings.updates.updateStarted'), AdminI18n.t('settings.updates.creatingSystemBackupAndApplying'));
      const data = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.UPDATE_APPLY);
      if (data?.requested) {
        // An image installation: the updater does it. The panel follows its reports.
        this.notify(NotificationType.INFO, AdminI18n.t('settings.updates.selfUpdate.requestedTitle'), AdminI18n.t(data.updaterRunning ? 'settings.updates.selfUpdate.requested' : 'settings.updates.selfUpdate.notRunning', { version: data.requested }));
        this.showConfirm = false;
        this.updating = false;
        await this.fetchStatus();
        return;
      }
      this.notify(NotificationType.SUCCESS, AdminI18n.t('settings.updates.updateComplete'), AdminI18n.t('settings.updates.systemUpdatedToVThe', { version: data.version }));
      this.showConfirm = false;

      // Wait a bit for the notify to be seen and for potential server restart
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (err: any) {
      this.notify(NotificationType.ERROR, AdminI18n.t('settings.updates.updateFailed'), err.message);
      this.updating = false;
    }
  }

  @bound
  openConfirm(): void {
    this.showConfirm = true;
  }

  @bound
  closeConfirm(): void {
    this.showConfirm = false;
  }

  render(): ReactNode {
    // WHERE before WHO, as on Infrastructure and Backups. Applying an update replaces the framework
    // every site runs on and restarts the box; offering that button from a console headed with one
    // customer's name says it is that customer's to press.
    return (
      <PlatformScopeGate page what={AdminI18n.t('settings.updates.updates')}>
        {this.body()}
      </PlatformScopeGate>
    );
  }

  private body(): ReactNode {
    if (!this.canManagePlatform) {
      return (
        <PlatformOnlyPanel detail={AdminI18n.t('settings.updates.aSystemUpdateReplacesThe')} />
      );
    }

    const theme = this.theme;
    const loading = this.loading;
    const updating = this.updating;
    const status = this.status;

    if (loading && !status) return <Loader fullPage label={AdminI18n.t('settings.updates.checkingTheUpdateRegistry')} />;

    const installedVersion = this.installedVersion;
    const latestVersion = this.latestVersion;
    const hasUpdate = this.hasUpdate;
    const latestVersionUnknown = this.latestVersionUnknown;

    return (
      <div className="flex flex-col h-full">
        <CompactPageHeader
          theme={theme}
          title={AdminI18n.t('settings.updates.systemUpdates')}
          subtitle={AdminI18n.t('settings.updates.frameworkCoreRegistrySynchronization')}
          actions={(
            <Button variant={ButtonVariant.SECONDARY} isLoading={loading} icon={<FrameworkIcons.Refresh size={15} />} onClick={() => this.fetchStatus(true) /* look again, not from the api's memory */}>
              {loading ? AdminI18n.t('settings.updates.verifyingRegistry') : AdminI18n.t('settings.updates.checkForUpdates')}
            </Button>
          )}
        />

        <div className="fc-columns__stack">
          <RecordCard
            title={AppEnv.PRODUCT_NAME}
            aside={(
              <StateBadge tone={hasUpdate ? 'warning' : latestVersionUnknown ? 'default' : 'success'}>
                {hasUpdate ? AdminI18n.t('settings.updates.updateAvailable') : latestVersionUnknown ? AdminI18n.t('settings.updates.updateCheckFailed') : AdminI18n.t('settings.updates.frameworkUpToDate')}
              </StateBadge>
            )}
          >
            <div className="fc-stack">
              <Text muted>{AdminI18n.t('settings.updates.theCoreEnginePowersAll')}</Text>
              {/* NEVER echo the installed version as the latest. That is what made an unreachable
                  registry look like "you are current". */}
              <AdminFactGrid facts={[
                { key: 'installed', label: AdminI18n.t('settings.updates.installedVersion'), value: installedVersion ? `v${installedVersion}` : '-' },
                { key: 'latest', label: AdminI18n.t('settings.updates.latestRegistryVersion'), value: latestVersionUnknown ? AdminI18n.t('settings.updates.unknown') : `v${latestVersion}` },
              ]} />
              {latestVersionUnknown ? <Alert tone="danger">{this.checkError || AdminI18n.t('settings.updates.theRegistryDidNotReport')}</Alert> : null}

              {hasUpdate ? (
                <>
                  {/* An image installation's button asks its updater service; any other installs in place. */}
                  <Alert tone="warning" title={AdminI18n.t('settings.updates.recommendedUpdate', { version: latestVersion })}
                    action={this.canApplyInPlace || this.status?.selfUpdate ? (
                      <Button variant={ButtonVariant.PRIMARY} isLoading={updating} onClick={this.openConfirm}>
                        {updating ? AdminI18n.t('settings.updates.applyingUpdate') : AdminI18n.t('settings.updates.installCore', { version: latestVersion })}
                      </Button>
                    ) : undefined} />
                  {/* The notes are the release's own; nothing is written here for a release that said nothing. */}
                  <PendingReleaseList releases={this.status?.releases || []} />
                </>
              ) : null}
            </div>
          </RecordCard>

          {status?.selfUpdate && <SelfUpdatePanel selfUpdate={status.selfUpdate} onChanged={this.fetchStatus} onPolled={this.takeStatus} />}
          <PluginAutoUpdatePanel />
          <PendingSavesBar />

          {status?.lastUpdated ? <Text size="xsmall" muted>{AdminI18n.t('settings.updates.lastRegistrySync', { at: new Date(status.lastUpdated).toLocaleString() })}</Text> : null}

          <ConfirmDialog
            isOpen={this.showConfirm}
            onClose={this.closeConfirm}
            onConfirm={this.handleUpdate}
            isLoading={updating}
            title={AdminI18n.t('settings.updates.applySystemUpdate')}
            description={AdminI18n.t(this.canApplyInPlace ? 'settings.updates.youAreAboutToUpdate' : 'settings.updates.youAreAboutToUpdateBesideRunning', { PRODUCT_NAME: AppEnv.PRODUCT_NAME, installedVersion: installedVersion, latestVersion: latestVersion })}
          />
        </div>
      </div>
    );
  }
}
