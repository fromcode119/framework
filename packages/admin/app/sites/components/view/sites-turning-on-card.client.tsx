import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { PluginRuntimeWaitService } from '@/lib/plugin-runtime-wait-service';
import { RestartApiAction } from '@/app/settings/infrastructure/restart-api-action.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Shown after the FIRST site is created, imported or adopted, while the api restarts to turn sites on.
 *
 * Sites are decided when the api starts, so the api restarts itself as soon as the first one exists
 * (the answer carries `restart`). This card waits for it to come back, then opens the new site — the
 * same select-and-reload the header switcher does — so Media and People work straight away instead of
 * still saying there is no site. When the new site cannot be opened by this account (it was created
 * for someone else), the fallback is the site's own page. When the api did not restart itself, the
 * card offers the restart instead of claiming one.
 */
export class SitesTurningOnCard extends AdminComponent {
  declare props: { tenantId: string; restarting: boolean; fallbackHref: string };

  @state timedOut = false;

  async componentDidMount(): Promise<void> {
    if (!this.props.restarting) return;
    if (!(await PluginRuntimeWaitService.waitForFrameworkRecovery())) {
      this.timedOut = true;
      return;
    }
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.TENANTS_SELECT, { tenantId: this.props.tenantId });
      window.location.assign(AdminConstants.ROUTES.ROOT);
    } catch {
      window.location.assign(this.props.fallbackHref);
    }
  }

  render(): ReactNode {
    if (!this.props.restarting) {
      return (
        <Card title={AdminI18n.t('sites.turningOn.restartNeeded')} icon={<FrameworkIcons.Refresh size={16} />}>
          <p className="fc-sites__text">{AdminI18n.t('sites.turningOn.restartNeededExplained')}</p>
          <div className="fc-sites__actions">
            <RestartApiAction label={AdminI18n.t('sites.restartTheApiToTurn')} />
          </div>
        </Card>
      );
    }
    return (
      <Card title={AdminI18n.t('sites.turningOn.title')} icon={<FrameworkIcons.Globe size={16} />}>
        <p className="fc-sites__text">{AdminI18n.t('sites.turningOn.explained')}</p>
        {this.timedOut
          ? <p className="fc-sites__text fc-sites__text--warn">{AdminI18n.t('sites.turningOn.timedOut')}</p>
          : <Loader label={AdminI18n.t('sites.turningOn.waiting')} />}
      </Card>
    );
  }
}
