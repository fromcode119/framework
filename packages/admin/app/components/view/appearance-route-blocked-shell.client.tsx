import { WorkspaceAppearanceLock } from '@/lib/appearance/workspace-appearance-lock';
import type { IAppearanceShellProps } from '@/lib/appearance/interfaces/appearance-shell-props.interface';
import type { ReactNode } from 'react';
import { prop } from '@fromcode119/react-class-components';
import { AppPathConstants } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminAppearanceRegistry } from '@/lib/appearance/admin-appearance-registry';
import type { IAppearanceShellUser } from '@/lib/appearance/interfaces/appearance-shell-user.interface';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';

/**
 * Rendered in place of an appearance shell when the current route is NOT in the active appearance's surface
 * allowlist (see AppearanceSurfacePolicy). This is presentation-only CONTAINMENT — the API still governs
 * authorization server-side; this only decides which surfaces the active skin presents. It offers a way back
 * into the workspace and — for a super-admin — a link to appearance settings so they can switch to the
 * standard admin (the anti-lockout escape hatch; `/settings/appearance` is always reachable by policy).
 */
export class AppearanceRouteBlockedShell extends AdminComponent {
  /**
   * Mapped over the interface, not the interface itself: an interface has no implicit index signature,
   * so it is not assignable to React's `props` (Record<string, unknown>) and the override is rejected.
   */
  declare props: Pick<IAppearanceShellProps, keyof IAppearanceShellProps>;

  constructor(props: Pick<IAppearanceShellProps, keyof IAppearanceShellProps>) {
    super(props);
  }

  @prop declare user?: IAppearanceShellUser;
  /**
   * Accepted but unrendered: this stands in for the appearance shell when a route is blocked, so it
   * must satisfy the same shell contract its caller types the slot with.
   */
  @prop declare children?: ReactNode;
  @prop declare nav?: IAppearanceShellProps['nav'];

  private get label(): string {
    return AdminAppearanceRegistry.shared.get(this.activeAppearanceId)?.label || 'this';
  }

  private get isSuperAdmin(): boolean {
    return Boolean(this.user?.roles?.includes('admin'));
  }

  render(): ReactNode {
    const label = this.label;
    return (
      <div className="flex min-h-screen items-center justify-center fc-canvas p-6 ">
        <div className={`w-full max-w-md ${AdminClass.SURFACE} p-8 text-center`}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full fc-tone-raised fc-tone-muted" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h1 className="text-lg font-medium fc-tone-text">{AdminI18n.t('shell.blocked.title', { label })}</h1>
          <p className="mt-2 text-sm fc-tone-muted">
            {AdminI18n.t('shell.blocked.body', { label })}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button variant={ButtonVariant.PRIMARY} href={AppPathConstants.ADMIN.ROOT}>
              {AdminI18n.t('shell.blocked.back', { label })}
            </Button>
            {this.isSuperAdmin && !WorkspaceAppearanceLock.locked && (
              <Button variant={ButtonVariant.SECONDARY} href={AppPathConstants.ADMIN.SETTINGS.APPEARANCE}>
                {AdminI18n.t('shell.blocked.switch')}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
