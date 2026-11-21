import { ApiStatus } from '@/app/enums/api-status.enum';
import type { ReactElement } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';

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

  /** How often the api is asked while it answers, and while it does not: the warning goes as soon as it answers again. */
  private static readonly ONLINE_CHECK_MS = 30000;
  private static readonly OFFLINE_CHECK_MS = 5000;

  private mounted = false;
  private timerId: number | null = null;

  componentDidMount(): void {
    this.mounted = true;
    void this.checkStatus();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    if (this.timerId !== null) window.clearTimeout(this.timerId);
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
    if (!this.mounted) return;
    // A check made during an api restart left the warning up for the next 30 seconds, under a console
    // that already worked; while it is up the api is asked again every few seconds instead.
    const wait = this.apiStatus === ApiStatus.OFFLINE ? ClientLayoutHeader.OFFLINE_CHECK_MS : ClientLayoutHeader.ONLINE_CHECK_MS;
    this.timerId = window.setTimeout(() => void this.checkStatus(), wait);
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
          <Button type="button" variant={ButtonVariant.GHOST} size={FieldSize.ICON} onClick={this.onMenuClick} aria-label={AdminI18n.t('shell.openMenu')}>
            <FrameworkIcons.Menu size={20} />
          </Button>
        </header>
        {this.warning}
      </>
    );
  }
}
