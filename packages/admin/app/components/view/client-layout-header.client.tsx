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
        <div role="alert" className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-6 py-2 text-[12px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 lg:px-12">
          <FrameworkIcons.Alert size={14} />
          {AdminI18n.t('shell.status.offlineHint')}
        </div>
      );
    }
    if (this.isMaintenance) {
      return (
        <div role="status" className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-[12px] font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 lg:px-12">
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
        <header className="flex h-14 items-center border-b bg-white px-4 dark:border-slate-800 dark:bg-[#020617] lg:hidden">
          <button
            type="button"
            onClick={this.onMenuClick}
            aria-label={AdminI18n.t('shell.openMenu')}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <FrameworkIcons.Menu size={20} />
          </button>
        </header>
        {this.warning}
      </>
    );
  }
}
