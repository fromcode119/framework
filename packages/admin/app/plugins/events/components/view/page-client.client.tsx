import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { PlatformOnlyPanel } from '@/components/view/platform-only-panel.client';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { EventDeliveriesPageController } from '@/app/plugins/events/event-deliveries-page-controller';
import type { IEventDeliveryFailure } from '@/app/plugins/events/interfaces/event-delivery-failure.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The console's view of events a plugin listener failed to handle: the open failures, each retryable.
 * Platform scope only — the ledger spans every site, which is the operator's view.
 */
export class EventDeliveriesPageClient extends AdminComponent {
  private mounted = false;

  @state loading = true;
  @state failures: IEventDeliveryFailure[] = [];
  @state retryingId: string | number | null = null;

  private get canManagePlatform(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user);
  }

  componentDidMount(): void {
    this.mounted = true;
    if (!this.canManagePlatform) {
      this.loading = false;
      return;
    }
    void this.fetch();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetch(): Promise<void> {
    this.loading = true;
    try {
      const failures = await EventDeliveriesPageController.fetchFailures();
      if (this.mounted) this.failures = failures;
    } catch (error) {
      if (this.mounted) this.failures = [];
      console.error('[EventDeliveriesPage] Failed to fetch failures:', error);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private async retry(id: string | number): Promise<void> {
    const { notify } = this.runtime.notify;
    this.retryingId = id;
    try {
      await EventDeliveriesPageController.retry(id);
      notify(NotificationType.SUCCESS, AdminI18n.t('plugins.events.retried'), AdminI18n.t('plugins.events.retriedDetail'));
      await this.fetch();
    } catch (error) {
      notify(NotificationType.ERROR, AdminI18n.t('plugins.events.retryFailed'), (error as { message?: string })?.message || '');
    } finally {
      if (this.mounted) this.retryingId = null;
    }
  }

  render(): ReactNode {
    if (!this.canManagePlatform) {
      return <PlatformOnlyPanel detail={AdminI18n.t('plugins.events.platformOnly')} />;
    }
    if (this.loading) {
      return <p className="admin-muted">{AdminI18n.t('plugins.events.loading')}</p>;
    }
    if (!this.failures.length) {
      return <p className="admin-muted">{AdminI18n.t('plugins.events.none')}</p>;
    }
    return (
      <table className="admin-table">
        <thead>
          <tr>
            <th>{AdminI18n.t('plugins.events.event')}</th>
            <th>{AdminI18n.t('plugins.events.plugin')}</th>
            <th>{AdminI18n.t('plugins.events.attempts')}</th>
            <th>{AdminI18n.t('plugins.events.error')}</th>
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {this.failures.map((failure) => (
            <tr key={String(failure.id)}>
              <td>{failure.event}</td>
              <td>{failure.pluginSlug}</td>
              <td>{failure.attempts}</td>
              <td>{failure.error}</td>
              <td>
                <button type="button" disabled={this.retryingId === failure.id} onClick={() => void this.retry(failure.id)}>
                  {AdminI18n.t('plugins.events.retry')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
}
