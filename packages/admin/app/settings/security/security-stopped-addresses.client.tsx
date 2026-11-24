import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { IEdgeStopRecord } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Security → Dashboard → Stopped addresses: who the gateway stopped as a scanner, when, until when,
 * which sites it tried, what it asked for and how many of its requests were refused — and, for a stop
 * still in force, "Release" (it was a mistake) or "Block for good" (adds it to Edge protection's
 * Blocked addresses). Platform admins only, like the rest of this tab.
 */
export class SecurityStoppedAddresses extends AdminComponent {
  @state stops: IEdgeStopRecord[] | null = null;
  @state loadError: string | null = null;
  @state pending: { stop: IEdgeStopRecord; block: boolean } | null = null;
  @state acting = false;

  async componentDidMount(): Promise<void> {
    await this.load();
  }

  @bound
  async load(): Promise<void> {
    this.loadError = null;
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.EDGE_STOPS);
      this.stops = Array.isArray(data?.stops) ? data.stops : [];
    } catch (err: any) {
      this.loadError = err?.message || AdminI18n.t('settings.security.stoppedAddressesLoadFailed');
    }
  }

  @bound
  close(): void {
    this.pending = null;
  }

  @bound
  async confirm(): Promise<void> {
    const pending = this.pending;
    if (!pending) return;
    this.acting = true;
    const id = String(pending.stop.id);
    try {
      await AdminApi.post(pending.block ? AdminConstants.ENDPOINTS.SYSTEM.EDGE_STOP_BLOCK(id) : AdminConstants.ENDPOINTS.SYSTEM.EDGE_STOP_RELEASE(id), {});
      this.runtime.notify.addNotification({
        title: AdminI18n.t(pending.block ? 'settings.security.stopBlockedTitle' : 'settings.security.stopReleasedTitle'),
        message: AdminI18n.t(pending.block ? 'settings.security.stopBlockedMessage' : 'settings.security.stopReleasedMessage', { address: pending.stop.address }),
        type: NotificationType.SUCCESS,
      });
      this.pending = null;
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: AdminI18n.t('settings.security.stopActionFailed'), message: err?.message || '', type: NotificationType.ERROR });
    } finally {
      this.acting = false;
      await this.load();
    }
  }

  private static time(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString(AdminI18n.locale, { dateStyle: 'short', timeStyle: 'short' });
  }

  private badge(stop: IEdgeStopRecord): ReactNode {
    if (stop.active) return <StateBadge tone="danger">{AdminI18n.t('settings.security.stopActiveUntil', { until: SecurityStoppedAddresses.time(stop.until) })}</StateBadge>;
    if (stop.releaseAction === 'blocked') return <StateBadge tone="danger">{AdminI18n.t('settings.security.stopBlockedForGood')}</StateBadge>;
    if (stop.releaseAction === 'released') return <StateBadge>{AdminI18n.t('settings.security.stopReleased')}</StateBadge>;
    return <StateBadge>{AdminI18n.t('settings.security.stopEnded')}</StateBadge>;
  }

  private row(stop: IEdgeStopRecord): ReactNode {
    const parts = [
      AdminI18n.t('settings.security.stopStoppedAt', { at: SecurityStoppedAddresses.time(stop.stoppedAt) }),
      stop.hosts.length ? AdminI18n.t('settings.security.stopSites', { sites: stop.hosts.join(', ') }) : '',
      stop.paths.length ? AdminI18n.t('settings.security.stopAskedFor', { paths: stop.paths.join(', ') }) : '',
      AdminI18n.t('settings.security.stopRefused', { count: stop.refused }),
    ].filter(Boolean);
    return (
      <ListRow
        key={stop.id}
        icon={<FrameworkIcons.ShieldAlert size={16} />}
        title={<code>{stop.address}</code>}
        badges={this.badge(stop)}
        description={parts.join(' · ')}
        descriptionTitle={parts.join('\n')}
        failed={stop.active}
        menu={stop.active ? [
          { label: AdminI18n.t('settings.security.stopRelease'), onClick: () => { this.pending = { stop, block: false }; } },
          { label: AdminI18n.t('settings.security.stopBlock'), variant: DropdownItemVariant.DANGER, onClick: () => { this.pending = { stop, block: true }; } },
        ] : undefined}
      />
    );
  }

  render(): ReactNode {
    const title = AdminI18n.t('settings.security.stoppedAddresses');
    if (this.loadError) return <LoadErrorPanel title={title} message={this.loadError} onRetry={this.load} isRetrying={false} />;
    if (this.stops === null) return null;
    if (!this.stops.length) {
      return (
        <RecordCard title={title}>
          <EmptyState inline icon={<FrameworkIcons.Check size={16} />} title={AdminI18n.t('settings.security.noStoppedAddresses')} />
        </RecordCard>
      );
    }
    const active = this.stops.filter((stop) => stop.active).length;
    const pending = this.pending;
    return (
      <>
        <ListShell title={title} count={this.stops.length} subtitle={AdminI18n.t('settings.security.stoppedAddressesSubtitle', { active })}>
          <div>{this.stops.map((stop) => this.row(stop))}</div>
        </ListShell>
        <ConfirmDialog
          isOpen={pending !== null}
          onClose={this.close}
          onConfirm={this.confirm}
          isLoading={this.acting}
          variant={pending?.block ? ButtonVariant.DANGER : undefined}
          title={AdminI18n.t(pending?.block ? 'settings.security.stopBlockConfirmTitle' : 'settings.security.stopReleaseConfirmTitle', { address: pending?.stop.address ?? '' })}
          description={AdminI18n.t(pending?.block ? 'settings.security.stopBlockConfirmText' : 'settings.security.stopReleaseConfirmText')}
          confirmLabel={AdminI18n.t(pending?.block ? 'settings.security.stopBlock' : 'settings.security.stopRelease')}
        />
      </>
    );
  }
}
