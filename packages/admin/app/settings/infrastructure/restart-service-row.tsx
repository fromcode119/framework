import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { SettingRow } from '@/app/settings/general/setting-row';
import { AdminDeployApp } from '@/lib/settings/admin-deploy-app';
import { RestartAppCopy } from '@/app/settings/infrastructure/restart-app-copy';

/**
 * One app's restart row: what the button does, and — when it cannot be pressed — why, stated in the
 * row rather than discovered by clicking it.
 */
export class RestartServiceRow extends PureReactor {
  @prop declare entry: AdminDeployApp;
  @prop declare theme: ThemeMode;
  /** Why this row is disabled, '' when it is live. Resolved by the card, which knows the deployment. */
  @prop declare blockedReason: string;
  @prop declare busy: boolean;
  @prop declare restarting: boolean;
  @prop declare onRequest: (app: string) => void;

  @bound
  protected requestRestart(): void {
    this.onRequest(this.entry.app);
  }

  render(): ReactNode {
    const copy = RestartAppCopy.for(this.entry.app);
    return (
      <SettingRow
        theme={this.theme}
        icon={FrameworkIcons.Refresh}
        title={copy.title}
        description={this.blockedReason ? `${copy.description} ${this.blockedReason}` : copy.description}
      >
        <Button
          variant={ButtonVariant.DANGER}
          disabled={Boolean(this.blockedReason) || this.busy}
          isLoading={this.restarting}
          onClick={this.requestRestart}
          icon={<FrameworkIcons.Refresh size={13} />}
        >
          Restart
        </Button>
      </SettingRow>
    );
  }
}
