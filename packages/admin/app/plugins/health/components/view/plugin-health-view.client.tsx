import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { Loader } from '@/components/ui/view/loader.client';
import { Alert } from '@/components/ui/view/alert.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { StatePage } from '@/components/ui/view/state-page.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { Tooltip } from '@/components/ui/view/tooltip.client';
import { FrameworkIcons } from '@fromcode119/react';
import { PluginHeldLabel } from '@/components/plugins/plugin-held-label';
import type { IPluginHealthEntry } from '@/app/plugins/health/interfaces/plugin-health-entry.interface';
import type { IPluginHealthReport } from '@/app/plugins/health/interfaces/plugin-health-report.interface';
import { PluginRestartPendingList } from '@/app/plugins/health/components/view/plugin-restart-pending-list.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class PluginHealthView extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<PluginHealthView, 'loading' | 'report' | 'isBusy' | 'busySlug' | 'onApproveEnable' | 'onReapproveAll' | 'onLoadInstalled' | 'theme'>;

  @prop declare loading: boolean;
  @prop declare report: IPluginHealthReport | null;
  @prop declare isBusy: boolean;
  @prop declare busySlug: string | null;
  @prop declare onApproveEnable: (slug: string) => Promise<void>;
  @prop declare onReapproveAll: () => Promise<void>;
  @prop declare onLoadInstalled: (slug: string) => Promise<void>;
  @prop declare theme: ThemeMode;

  private drift(entry: IPluginHealthEntry): string {
    return [
      ...(entry.addedCapabilities || []).map((c) => `+${c}`),
      ...(entry.removedCapabilities || []).map((c) => `-${c}`),
    ].join(' ');
  }

  render(): ReactNode {
    if (this.loading) return <Loader label={AdminI18n.t('plugins.list.loadingPlatformHealth')} />;
    if (!this.report) {
      return <StatePage icon={<FrameworkIcons.Activity size={18} />} title={AdminI18n.t('plugins.list.healthReportUnavailable')} hint={AdminI18n.t('plugins.list.couldNotLoadThePlatform')} />;
    }

    const counts = this.report.counts;
    const figures = [
      [AdminI18n.t('plugins.list.total'), counts.total],
      [AdminI18n.t('plugins.list.active'), counts.active],
      [AdminI18n.t('plugins.list.held'), counts.held],
      [AdminI18n.t('plugins.list.errors'), counts.error],
      [AdminI18n.t('plugins.list.inactive'), counts.inactive],
    ].map(([label, value]) => `${label} ${value}`).join(' · ');
    // A plugin serving an older build than the one installed counts: the report says "attention needed"
    // for it, and this screen used to answer "everything looks healthy" beside that badge.
    const needsAttention = counts.held > 0 || counts.error > 0 || counts.restartPending > 0;

    return (
      <div className="fc-columns__stack">
        <Alert tone={this.report.ok ? 'success' : 'warning'} title={this.report.ok ? AdminI18n.t('plugins.list.allHealthy') : AdminI18n.t('plugins.list.attentionNeeded')}>{figures}</Alert>

        {counts.held > 0 ? (
          <Alert tone="warning" title={AdminI18n.t('plugins.list.capabilityChangeDetected')}
            action={<Button variant={ButtonVariant.SECONDARY} isLoading={this.isBusy && !this.busySlug} disabled={this.isBusy} icon={<FrameworkIcons.Shield size={15} />} onClick={this.onReapproveAll}>{AdminI18n.t('plugins.list.reApproveAllHeld')}</Button>}>
            {AdminI18n.t(counts.held === 1 ? 'plugins.list.heldOne' : 'plugins.list.heldMany', { count: counts.held })}
          </Alert>
        ) : null}

        {needsAttention ? (
          <ListShell title={AdminI18n.t('plugins.list.needsAttention')} count={counts.held + counts.error + counts.restartPending}>
            <div>
              {this.report.held.map((entry) => {
                const drift = this.drift(entry);
                // `entry` is API JSON, so `heldReason` is a raw string here — resolve before comparing.
                const label = <Badge variant={BadgeVariant.WARNING}>{PluginHeldLabel.of(entry.heldReason)}</Badge>;
                return (
                  <ListRow key={entry.slug} icon={<FrameworkIcons.Zap size={16} />} title={entry.slug}
                    badges={drift ? <Tooltip content={AdminI18n.t('plugins.list.capabilityChangeSinceApproval', { drift })}>{label}</Tooltip> : label}
                    description={AdminI18n.t('plugins.list.heldPendingReApprovalOf')}
                    actions={<Button variant={ButtonVariant.SECONDARY} disabled={this.isBusy} isLoading={this.isBusy && this.busySlug === entry.slug} icon={<FrameworkIcons.Shield size={15} />} onClick={() => this.onApproveEnable(entry.slug)}>{AdminI18n.t('plugins.list.approveEnable')}</Button>} />
                );
              })}
              <PluginRestartPendingList entries={this.report.restartPending || []} isBusy={this.isBusy} busySlug={this.busySlug} onLoadInstalled={this.onLoadInstalled} theme={this.theme} />
              {this.report.error.map((entry) => (
                <ListRow key={entry.slug} icon={<FrameworkIcons.Alert size={16} />} title={entry.slug} failed
                  badges={<Badge variant={BadgeVariant.DANGER}>{AdminI18n.t('plugins.list.error')}</Badge>}
                  description={entry.error || AdminI18n.t('plugins.list.pluginFailedToInitialize')}
                  descriptionTitle={entry.error || undefined} />
              ))}
            </div>
          </ListShell>
        ) : (
          <RecordCard>
            <EmptyState icon={<FrameworkIcons.CheckCircle size={18} />} title={AdminI18n.t('plugins.list.everythingLooksHealthy')} hint={AdminI18n.t('plugins.list.noHeldCapabilityChangesNo')} />
          </RecordCard>
        )}
      </div>
    );
  }
}
