"use client";

import React from 'react';
import { AdminComponent } from '@/components/admin-component';
import PluginHealthView from './components/plugin-health-view';
import { PluginHealthPageController } from './plugin-health-page-controller';
import type { PluginHealthPageClientState } from './plugin-health-page.interfaces';

export default class PluginHealthPageClient extends AdminComponent<Record<string, never>, PluginHealthPageClientState> {
  private mounted = false;
  private prevRefreshVersion: any = undefined;

  state: PluginHealthPageClientState = {
    loading: true,
    report: null,
    isBusy: false,
    busySlug: null,
  };

  componentDidMount(): void {
    this.mounted = true;
    void this.fetchReport();
  }

  componentDidUpdate(): void {
    if (this.runtime.plugins?.refreshVersion !== this.prevRefreshVersion) {
      void this.fetchReport();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchReport(): Promise<void> {
    this.prevRefreshVersion = this.runtime.plugins?.refreshVersion;
    this.setState({ loading: true });
    try {
      const report = await PluginHealthPageController.fetchReport();
      if (!this.mounted) return;
      this.setState({ report });
    } catch (error) {
      console.error('[PluginHealthPage] Failed to fetch health report:', error);
      if (this.mounted) this.setState({ report: null });
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private async approveEnable(slug: string): Promise<void> {
    const { notify } = this.runtime.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    this.setState({ isBusy: true, busySlug: slug });
    try {
      await PluginHealthPageController.approveEnable(slug);
      notify('success', 'Plugin Approved', `${slug} has been re-approved and enabled.`);
      await this.fetchReport();
      triggerRefresh?.();
    } catch (error: any) {
      notify('error', 'Approval Failed', error.message);
    } finally {
      if (this.mounted) this.setState({ isBusy: false, busySlug: null });
    }
  }

  private async reapproveAll(): Promise<void> {
    const { notify } = this.runtime.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    this.setState({ isBusy: true });
    try {
      const failed = await PluginHealthPageController.reapproveAll();
      if (failed.length > 0) {
        notify('error', 'Re-approval Incomplete', PluginHealthPageController.reapprovalFailureMessage(failed));
      } else {
        notify('success', 'Plugins Re-approved', 'All held plugins have been re-approved and enabled.');
      }
      await this.fetchReport();
      triggerRefresh?.();
    } catch (error: any) {
      notify('error', 'Re-approval Failed', error.message);
    } finally {
      if (this.mounted) this.setState({ isBusy: false });
    }
  }

  render(): React.ReactNode {
    const { loading, report, isBusy, busySlug } = this.state;

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
