import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { PlatformOnlyPanel } from '@/components/view/platform-only-panel.client';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { PluginHealthView } from '@/app/plugins/health/components/view/plugin-health-view.client';
import { PluginHealthPageController } from '@/app/plugins/health/plugin-health-page-controller';
import type { IPluginHealthReport } from '@/app/plugins/health/interfaces/plugin-health-report.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { PluginConsentHost } from '@/components/plugins/view/plugin-consent-host.client';

export class PluginHealthPageClient extends AdminComponent {
  private mounted = false;
  private prevRefreshVersion: any = undefined;

  @state loading = true;
  @state report: IPluginHealthReport | null = null;
  @state isBusy = false;
  @state busySlug: string | null = null;
  /** Plugins whose consent dialog is showing or queued. */
  @state consentSlugs: string[] = [];

  /** The registry being reported on is the shared container's, not this site's. */
  private get canManagePlatform(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user);
  }

  componentDidMount(): void {
    this.mounted = true;
    if (!this.canManagePlatform) {
      this.loading = false;
      return;
    }
    void this.fetchReport();
  }

  componentDidUpdate(): void {
    if (!this.canManagePlatform) return;
    if (this.runtime.plugins?.refreshVersion !== this.prevRefreshVersion) {
      void this.fetchReport();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchReport(): Promise<void> {
    this.prevRefreshVersion = this.runtime.plugins?.refreshVersion;
    this.loading = true;
    try {
      const report = await PluginHealthPageController.fetchReport();
      if (!this.mounted) return;
      this.report = report;
    } catch (error) {
      console.error('[PluginHealthPage] Failed to fetch health report:', error);
      if (this.mounted) this.report = null;
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  /** Approving a held plugin is the consent dialog's job: it shows what the plugin asks for first. */
  private approveEnable(slug: string): void {
    this.consentSlugs = [slug];
  }

  private async loadInstalled(slug: string): Promise<void> {
    const { notify } = this.runtime.notify;
    this.isBusy = true;
    this.busySlug = slug;
    try {
      const outcome = await PluginHealthPageController.loadInstalled(slug);
      if (outcome.restartScheduled) {
        notify(NotificationType.INFO, 'API restarting', AdminI18n.t('plugins.list.runsInsideTheApiSo', { slug: slug }));
        return;
      }
      notify(NotificationType.SUCCESS, AdminI18n.t('plugins.list.installedVersionLoaded'), AdminI18n.t('plugins.list.sProcessWasReplacedOn', { slug: slug }));
      await this.fetchReport();
      this.runtime.plugins?.triggerRefresh?.();
    } catch (error: any) {
      notify(NotificationType.ERROR, AdminI18n.t('plugins.list.couldNotLoadTheInstalled'), error.message);
    } finally {
      if (this.mounted) {
        this.isBusy = false;
        this.busySlug = null;
      }
    }
  }

  /** One consent dialog per held plugin, in turn. */
  private reapproveAll(): void {
    this.consentSlugs = (this.report?.held || []).map((entry) => entry.slug);
  }

  private consentFinished(): void {
    this.consentSlugs = [];
    void this.fetchReport();
    this.runtime.plugins?.triggerRefresh?.();
  }

  render(): ReactNode {
    if (!this.canManagePlatform) {
      return (
        <PlatformOnlyPanel detail={AdminI18n.t('plugins.list.pluginHealthReportsTheRegistry')} />
      );
    }

    const { loading, report, isBusy, busySlug } = this;

    return (
      <>
      <PluginConsentHost slugs={this.consentSlugs} onApproved={() => undefined} onFinished={() => this.consentFinished()} />
      <PluginHealthView
        loading={loading}
        report={report}
        isBusy={isBusy}
        busySlug={busySlug}
        onApproveEnable={async (slug) => this.approveEnable(slug)}
        onReapproveAll={async () => this.reapproveAll()}
        onLoadInstalled={(slug) => this.loadInstalled(slug)}
        theme={this.theme}
      />
      </>
    );
  }
}
