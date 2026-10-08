import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { TenantOption } from '@/lib/tenants/tenant-option';
import { TenantScopeClient } from '@/lib/tenants/tenant-scope-client';
import { SessionAppearanceChoice } from '@/lib/appearance/session-appearance-choice';
import { SidebarSiteItems } from '@/app/components/view/sidebar-site-items';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The way back out of a workspace a platform admin opened AS ITS OWN CONSOLE on the shared admin host.
 *
 * The site switcher lives in the default console's account menu. An appearance shell draws its own
 * chrome and is not obliged to carry one — the Hub's does not — so choosing "open as its console"
 * from the switcher used to be a one-way door: no Platform row, no Configure row, nothing that led
 * back. The framework owns the session's scope, so it owns the exit too, and draws it above whatever
 * shell is active rather than trusting every appearance to remember.
 *
 * Shown only for that session choice. A workspace DOMAIN is locked to its tenant by design, and the
 * configure mode already runs the default console with its full switcher.
 */
export class WorkspaceConsoleExitBar extends AdminComponent {
  private static readonly CONFIGURE = 'configure';

  @state private current: TenantOption | null = null;
  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    if (!WorkspaceConsoleExitBar.applies) return;
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.TENANTS_AVAILABLE, { noDedupe: true }).catch(() => null);
    if (!this.mounted || !response?.current) return;
    this.current = TenantOption.fromList(response.tenants).find((tenant) => tenant.id === response.current) ?? null;
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  /** A workspace opened as its appearance from the shared host — `default` is the configure mode. */
  private static get applies(): boolean {
    const choice = SessionAppearanceChoice.current;
    return choice !== null && choice !== 'default';
  }

  private async configure(): Promise<void> {
    const tenantId = this.current?.id;
    if (!tenantId) return;
    const failure = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.TENANTS_SELECT, { tenantId, mode: WorkspaceConsoleExitBar.CONFIGURE })
      .then(() => null)
      .catch((error: unknown) => SidebarSiteItems.reasonFor(error));
    if (!failure) {
      window.location.reload();
      return;
    }
    this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('shell.site.switch'), failure);
  }

  private async leave(): Promise<void> {
    if (!(await TenantScopeClient.leave())) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('shell.site.switch'), AdminI18n.t('shell.site.switchFailedNoReason'));
      return;
    }
    window.location.reload();
  }

  render(): ReactNode {
    const current = this.current;
    if (!WorkspaceConsoleExitBar.applies || !current) return null;
    const canLeave = PlatformAccess.canManagePlatform(this.auth.user);
    return (
      <div role="region" aria-label={AdminI18n.t('shell.workspaceConsole.label')} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-200 bg-slate-50 px-6 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 lg:px-8">
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <FrameworkIcons.Eye size={14} />
          <span className="truncate">{AdminI18n.t('shell.workspaceConsole.viewing', { name: current.label })}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => { void this.configure(); }} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            <FrameworkIcons.Settings size={13} />
            {AdminI18n.t('shell.workspaceConsole.configure')}
          </button>
          {canLeave ? (
            <button type="button" onClick={() => { void this.leave(); }} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <FrameworkIcons.ArrowLeft size={13} />
              {AdminI18n.t('shell.workspaceConsole.platform')}
            </button>
          ) : null}
        </span>
      </div>
    );
  }
}
