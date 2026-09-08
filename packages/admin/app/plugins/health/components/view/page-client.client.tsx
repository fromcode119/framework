import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';
import { state } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { PlatformOnlyPanel } from '@/components/view/platform-only-panel.client';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { PluginHealthView } from '@/app/plugins/health/components/view/plugin-health-view.client';
import { PluginHealthPageController } from '@/app/plugins/health/plugin-health-page-controller';
import type { IPluginHealthReport } from '@/app/plugins/health/interfaces/plugin-health-report.interface';

export class PluginHealthPageClient extends AdminComponent {
  private mounted = false;
  private prevRefreshVersion: any = undefined;

  @state loading = true;
  @state report: IPluginHealthReport | null = null;
  @state isBusy = false;
  @state busySlug: string | null = null;

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

  private async approveEnable(slug: string): Promise<void> {
    const { notify } = this.runtime.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    this.isBusy = true;
    this.busySlug = slug;
    try {
      await PluginHealthPageController.approveEnable(slug);
      notify(NotificationType.SUCCESS, 'Plugin Approved', `${slug} has been re-approved and enabled.`);
      await this.fetchReport();
      triggerRefresh?.();
    } catch (error: any) {
      notify(NotificationType.ERROR, 'Approval Failed', error.message);
    } finally {
      if (this.mounted) {
        this.isBusy = false;
        this.busySlug = null;
      }
    }
  }

  private async reapproveAll(): Promise<void> {
    const { notify } = this.runtime.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    this.isBusy = true;
    try {
      const failed = await PluginHealthPageController.reapproveAll();
      if (failed.length > 0) {
        notify(NotificationType.ERROR, 'Re-approval Incomplete', PluginHealthPageController.reapprovalFailureMessage(failed));
      } else {
        notify(NotificationType.SUCCESS, 'Plugins Re-approved', 'All held plugins have been re-approved and enabled.');
      }
      await this.fetchReport();
      triggerRefresh?.();
    } catch (error: any) {
      notify(NotificationType.ERROR, 'Re-approval Failed', error.message);
    } finally {
      if (this.mounted) this.isBusy = false;
    }
  }

  render(): ReactNode {
    if (!this.canManagePlatform) {
      return (
        <PlatformOnlyPanel detail="Plugin health reports the registry of the container every site runs on — which plugins are active, held or failing for the whole platform. Only a platform admin can see or act on it. Your own site's plugins, and each one's settings, are under Plugins." />
      );
    }

    const { loading, report, isBusy, busySlug } = this;

    return (
      <PluginHealthView
        loading={loading}
        report={report}
        isBusy={isBusy}
        busySlug={busySlug}
        onApproveEnable={(slug) => this.approveEnable(slug)}
        onReapproveAll={() => this.reapproveAll()}
        theme={this.theme}
      />
    );
  }
}
