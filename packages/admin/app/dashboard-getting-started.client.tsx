import type { ReactNode } from 'react';
import { prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminScope } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Alert } from '@/components/ui/view/alert.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { AdminPathUtils } from '@/lib/admin-path';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { DashboardChecklistText } from '@/app/dashboard-checklist-text';

/**
 * The first screen of an installation nobody has started using yet.
 *
 * Not a grid of zeros: a fresh install has nothing to count, and a stat card reading 0 next to a
 * 14-day chart of one event tells an operator nothing they can act on. Three steps, each with the
 * reason it matters, and the first undone one carries the primary button.
 */
export class DashboardGettingStarted extends AdminComponent {
  @prop declare steps: Array<Record<string, any>>;
  @prop declare mode?: string;
  @prop declare storefront?: string;
  /** `site` inside a site: the card is about that site, and the container's mode is not its business. */
  @prop declare scope?: string;

  /** Resolved, not compared: `scope` arrives as a JSON string, and a string never equals an enum member. */
  private get inSite(): boolean {
    return AdminScope.resolve(this.scope)?.isSite === true;
  }

  @bound
  private go(path: string): void {
    if (path) this.router.push(AdminPathUtils.toAdminPath(path));
  }

  private get firstUndoneKey(): string {
    return String(this.steps.find((step) => !step.done)?.key ?? '');
  }

  private marker(step: Record<string, any>, position: number): ReactNode {
    return (
      <span className="fc-setup__marker" aria-hidden="true">
        {step.done ? <FrameworkIcons.Check size={13} /> : position}
      </span>
    );
  }

  /** Said plainly, because the alternative is an operator creating a site record they do not need:
      tenancy switches on only when sites exist, and until then this deployment serves its own hosts. */
  private renderServing(): ReactNode {
    if (!this.storefront) return null;
    const where = this.inSite ? 'dashboard.setup.thisSite' : (this.mode === 'multi-site' ? 'dashboard.setup.multiSite' : 'dashboard.setup.singleSite');
    return (
      <Alert tone="info" title={AdminI18n.t(where)} className="fc-setup__note">
        {this.inSite
          ? <>{AdminI18n.t('dashboard.setup.servedAt')} <strong>{this.storefront}</strong></>
          : this.mode === 'multi-site'
          ? AdminI18n.t('dashboard.setup.multiHint')
          : <>{AdminI18n.t('dashboard.setup.serving')} <strong>{this.storefront}</strong> — {AdminI18n.t('dashboard.setup.singleHint')}</>}
      </Alert>
    );
  }

  render(): ReactNode {
    const next = this.firstUndoneKey;
    return (
      <Card
        title={AdminI18n.t(this.inSite ? 'dashboard.setup.titleSite' : 'dashboard.setup.titlePlatform')}
        description={AdminI18n.t(this.inSite ? 'dashboard.setup.textSite' : 'dashboard.setup.textPlatform')}
      >
        {this.renderServing()}
        <ol className="fc-setup__steps">
          {this.steps.map((step, position) => {
            const isNext = String(step.key) === next;
            return (
              <li key={String(step.key)} className="fc-setup__step" data-done={step.done ? 'true' : undefined} data-next={isNext ? 'true' : undefined}>
                {this.marker(step, position + 1)}
                <div className="fc-setup__text">
                  <div className="fc-setup__title">{DashboardChecklistText.title(step)}</div>
                  {step.done ? null : <div className="fc-setup__detail">{DashboardChecklistText.detail(step)}</div>}
                </div>
                {step.done ? null : (
                  <Button size={FieldSize.SM} variant={isNext ? ButtonVariant.PRIMARY : ButtonVariant.SECONDARY} onClick={() => this.go(String(step.actionPath))}>
                    {DashboardChecklistText.action(step)}
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    );
  }
}
