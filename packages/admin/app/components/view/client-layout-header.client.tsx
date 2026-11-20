import { ApiStatus } from '@/app/enums/api-status.enum';
import type { ReactElement } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What is left of the top header: nothing, while all is well.
 *
 * Its site switcher, theme toggle and assistant moved into the account menu at the foot of the
 * sidebar, and a permanent "Online" label said nothing worth a row of the screen. What remains is:
 * - on a phone or tablet, the bar with the button that opens the sidebar, which is otherwise off-screen;
 * - anywhere, a warning strip while the api does not answer or maintenance mode is on — the two
 *   states an operator must know about before they trust a save.
 */
export class ClientLayoutHeader extends AdminComponent {
  @prop declare onMenuClick: () => void;

  @state apiStatus: ApiStatus = ApiStatus.LOADING;
  @state isMaintenance = false;

  private mounted = false;
  private intervalId: number | null = null;

  componentDidMount(): void {
    this.mounted = true;
    this.checkStatus();
    this.intervalId = window.setInterval(() => this.checkStatus(), 30000);
  }

  componentWillUnmount(): void {
    this.mounted = false;
    if (this.intervalId !== null) window.clearInterval(this.intervalId);
  }

  private async checkStatus(): Promise<void> {
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.HEALTH);
      if (this.mounted) {
        this.apiStatus = ApiStatus.ONLINE;
        this.isMaintenance = data.maintenance === true;
      }
    } catch {
      if (this.mounted) this.apiStatus = ApiStatus.OFFLINE;
    }
  }

  private get warning(): ReactElement | null {
    if (this.apiStatus === ApiStatus.OFFLINE) {
      return (
        <div role="alert" className="flex items-center gap-2 border-b fc-tone-danger-line fc-tone-danger-soft px-6 py-2 fc-size-xs font-medium fc-tone-danger lg:px-12">
          <FrameworkIcons.Alert size={14} />
          {AdminI18n.t('shell.status.offlineHint')}
        </div>
      );
    }
    if (this.isMaintenance) {
      return (
        <div role="status" className="flex items-center gap-2 border-b fc-tone-warning-line fc-tone-warning-soft px-6 py-2 fc-size-xs font-medium fc-tone-warning lg:px-12">
          <FrameworkIcons.Zap size={14} />
          {AdminI18n.t('shell.status.maintenance')}
        </div>
      );
    }
    return null;
  }

  render(): ReactElement {
    return (
      <>
        <header className="fc-phone-bar fc-canvas lg:hidden">
          <button
            type="button"
            onClick={this.onMenuClick}
            aria-label={AdminI18n.t('shell.openMenu')}
            className="fc-btn fc-btn--icon"
          >
            <FrameworkIcons.Menu size={20} />
          </button>
        </header>
        {this.warning}
      </>
    );
  }
}
