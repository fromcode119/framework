import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminDeployClient } from '@/lib/settings/admin-deploy-client';
import { AdminDeployApp } from '@/lib/settings/admin-deploy-app';
import { RestartAppCopy } from '@/app/settings/infrastructure/restart-app-copy';
import { RestartServiceRow } from '@/app/settings/infrastructure/restart-service-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One button per app of this deployment, each restarting that app by exiting its process so the
 * container supervisor starts it again.
 *
 * The rows come from the api (`/system/deploy/apps`), never from a list written here, so an app this
 * install cannot actually reach shows a disabled button and the reason rather than a live-looking
 * one. Every button opens a confirmation naming exactly what goes down.
 */
export class RestartServicesCard extends AdminComponent {
  @state apps: AdminDeployApp[] = [];
  @state secretConfigured = false;
  @state secretEnvKey = '';
  @state loadError: string | null = null;
  /** The app the confirmation is open for, '' when closed. */
  @state pendingApp = '';
  /** The app whose restart request is in flight, '' when none. */
  @state restartingApp = '';

  async componentDidMount(): Promise<void> {
    try {
      const catalog = await AdminDeployClient.listApps();
      this.apps = catalog.apps;
      this.secretConfigured = catalog.secretConfigured;
      this.secretEnvKey = catalog.secretEnvKey;
    } catch (err: any) {
      this.loadError = err?.message || AdminI18n.t('settings.infrastructure.theRestartTargetsCouldNot');
    }
  }

  @bound
  protected openConfirm(app: string): void {
    this.pendingApp = app;
  }

  @bound
  protected closeConfirm(): void {
    this.pendingApp = '';
  }

  @bound
  protected async confirmRestart(): Promise<void> {
    const app = this.pendingApp;
    if (!app) return;
    const addNotification = this.runtime.notify.addNotification;
    this.restartingApp = app;
    try {
      const outcome = await AdminDeployClient.restart(app);
      addNotification({
        title: AdminI18n.t('settings.infrastructure.restartRequested'),
        message: AdminI18n.t('settings.infrastructure.theAppExitsInMs', { app: app, exitInMs: outcome.exitInMs }),
        type: NotificationType.INFO,
      });
      this.pendingApp = '';
    } catch (err: any) {
      addNotification({
        title: AdminI18n.t('settings.infrastructure.restartNotStarted'),
        message: err?.message || AdminI18n.t('settings.infrastructure.theAppCouldNotBe', { app: app }),
        type: NotificationType.ERROR,
      });
    } finally {
      this.restartingApp = '';
    }
  }

  /** Why a row's button is disabled, or '' when it is live. */
  private blockedReason(entry: AdminDeployApp): string {
    if (entry.restartable) return '';
    if (!this.secretConfigured) {
      return AdminI18n.t('settings.infrastructure.unavailableSetToTheSame', { secretEnvKey: this.secretEnvKey });
    }
    return AdminI18n.t('settings.infrastructure.unavailableThisInstallHasNo', { app: entry.app });
  }

  private get pendingCopy(): RestartAppCopy | null {
    return this.pendingApp ? RestartAppCopy.for(this.pendingApp) : null;
  }

  render(): ReactNode {
    if (this.loadError) {
      return (
        <Card title={AdminI18n.t('settings.infrastructure.restartServices')}>
          <p className="text-[13px] text-[var(--destructive)]">{this.loadError}</p>
        </Card>
      );
    }
    if (!this.apps.length) return null;

    const copy = this.pendingCopy;
    return (
      <Card title={AdminI18n.t('settings.infrastructure.restartServices')}>
        {this.apps.map((entry) => (
          <RestartServiceRow
            key={entry.app}
            entry={entry}
            theme={this.theme}
            blockedReason={this.blockedReason(entry)}
            busy={Boolean(this.restartingApp)}
            restarting={this.restartingApp === entry.app}
            onRequest={this.openConfirm}
          />
        ))}
        <ConfirmDialog
          isOpen={Boolean(this.pendingApp)}
          onClose={this.closeConfirm}
          onConfirm={this.confirmRestart}
          isLoading={Boolean(this.restartingApp)}
          title={AdminI18n.t('settings.infrastructure.restartTheApp2', { app: copy?.title || '' })}
          description={`${copy?.description || ''} ${copy?.warning || ''}`.trim()}
          confirmLabel={AdminI18n.t('settings.infrastructure.restartNow')}
        />
      </Card>
    );
  }
}
