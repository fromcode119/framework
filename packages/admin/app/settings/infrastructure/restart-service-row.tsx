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

  /**
   * The copy, why it is blocked, and — for an app the api calls over the network — the address it
   * will call. The address is shown rather than merely held: it is the value that decides whether
   * this button works and where the internal secret goes, so the operator can read it here instead
   * of inferring it from the deployment's environment.
   */
  private get description(): ReactNode {
    const copy = RestartAppCopy.for(this.entry.app);
    return (
      <>
        {this.blockedReason ? `${copy.description} ${this.blockedReason}` : copy.description}
        {this.entry.url && (
          <span className="mt-1 block font-mono text-[11px] text-[var(--muted-foreground)]">
            {this.entry.url}
          </span>
        )}
      </>
    );
  }

  render(): ReactNode {
    const copy = RestartAppCopy.for(this.entry.app);
    return (
      <SettingRow
        theme={this.theme}
        icon={FrameworkIcons.Refresh}
        title={copy.title}
        description={this.description}
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
