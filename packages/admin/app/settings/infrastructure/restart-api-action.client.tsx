import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { ApplicationUrlUtils } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminDeployClient } from '@/lib/settings/admin-deploy-client';
import { RestartAppCopy } from '@/app/settings/infrastructure/restart-app-copy';

/**
 * "Restart the API", offered AT the control whose change needs it.
 *
 * A few changes genuinely cannot reach a running process — new plugin code, turning tenancy on — and
 * the screens that made them used to end at a sentence: "restart the API", with the button on another
 * page. The operator either went looking for it or left the old state serving. This is the same
 * restart as Settings → Infrastructure → Restart Services, with the same confirmation, placed where
 * the need arises; when the deployment cannot restart itself, it says why instead of offering a
 * button that fails.
 */
export class RestartApiAction extends AdminComponent {
  declare props: { label?: string };

  @state restartable: boolean | null = null;
  @state blockedReason = '';
  @state confirming = false;
  @state restarting = false;

  async componentDidMount(): Promise<void> {
    try {
      const catalog = await AdminDeployClient.listApps();
      const api = catalog.apps.find((entry) => entry.app === ApplicationUrlUtils.API_APP);
      this.restartable = api?.restartable === true;
      if (!this.restartable) {
        this.blockedReason = catalog.secretConfigured
          ? 'This deployment cannot restart the API from the admin; restart it where it is hosted.'
          : `This deployment cannot restart the API from the admin until ${catalog.secretEnvKey} is set on the api, admin and frontend services; restart it where it is hosted.`;
      }
    } catch (err: any) {
      this.restartable = false;
      this.blockedReason = err?.message || 'The restart action could not be loaded; restart the API where it is hosted.';
    }
  }

  @bound
  protected open(): void {
    this.confirming = true;
  }

  @bound
  protected close(): void {
    this.confirming = false;
  }

  @bound
  protected async confirm(): Promise<void> {
    this.restarting = true;
    try {
      const outcome = await AdminDeployClient.restart(ApplicationUrlUtils.API_APP);
      this.runtime.notify.addNotification({
        title: 'Restart requested',
        message: `The API exits in ${outcome.exitInMs}ms and its supervisor starts it again. It is unavailable until then.`,
        type: NotificationType.INFO,
      });
      this.confirming = false;
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Restart not started', message: err?.message || 'The API could not be restarted.', type: NotificationType.ERROR });
    } finally {
      this.restarting = false;
    }
  }

  render(): ReactNode {
    if (this.restartable === null) return null;
    if (!this.restartable) return <p className="text-xs text-slate-500">{this.blockedReason}</p>;
    const copy = RestartAppCopy.for(ApplicationUrlUtils.API_APP);
    return (
      <>
        <Button variant={ButtonVariant.SECONDARY} size={FieldSize.SM} icon={<FrameworkIcons.Refresh size={14} />} onClick={this.open} isLoading={this.restarting}>
          {this.props.label || 'Restart the API now'}
        </Button>
        <ConfirmDialog
          isOpen={this.confirming}
          onClose={this.close}
          onConfirm={this.confirm}
          isLoading={this.restarting}
          title={`Restart the ${copy.title} app?`}
          description={`${copy.description} ${copy.warning}`.trim()}
          confirmLabel="Restart now"
        />
      </>
    );
  }
}
