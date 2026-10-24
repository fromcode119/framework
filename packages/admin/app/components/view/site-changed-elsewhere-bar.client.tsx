import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { TenantOption } from '@/lib/tenants/tenant-option';
import { TenantScopeClient } from '@/lib/tenants/tenant-scope-client';
import { SidebarSiteItems } from '@/app/components/view/sidebar-site-items';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Says so when ANOTHER tab moved the console to a different site, or opened the same site in the other
 * console (its own appearance or the standard one).
 *
 * The site and that choice live in the sign-in session, which every console tab in the browser shares.
 * Switching in one tab used to restyle and repoint every other tab on its next screen with no word of
 * why — a tab opened for one site quietly showed another site's appearance. Writes were already refused
 * (`site_changed`); this tab now notices on its own when it comes back into view, names both sites, and
 * offers to go back or to continue where the session is now.
 */
export class SiteChangedElsewhereBar extends AdminComponent {
  /** Where this page was opened: the site id (`null` = platform) and the console choice. */
  private opened: { site: string | null; mode: string | null } | null = null;

  @state private tenants: TenantOption[] = [];
  @state private now: { site: string | null; mode: string | null } | null = null;

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const response = await this.read();
    if (!this.mounted || !response || response.multiTenant !== true) return;
    this.opened = SiteChangedElsewhereBar.scopeOf(response);
    this.tenants = TenantOption.fromList(response.tenants);
    window.addEventListener('focus', this.check);
    document.addEventListener('visibilitychange', this.check);
  }

  componentWillUnmount(): void {
    this.mounted = false;
    window.removeEventListener('focus', this.check);
    document.removeEventListener('visibilitychange', this.check);
  }

  /** `noDedupe`: the session's site changes behind this tab's back, so a memoised answer is the bug. */
  private read(): Promise<any> {
    return AdminApi.get(AdminConstants.ENDPOINTS.AUTH.TENANTS_AVAILABLE, { noDedupe: true }).catch(() => null);
  }

  @bound private async check(): Promise<void> {
    if (document.visibilityState === 'hidden' || !this.opened) return;
    const response = await this.read();
    if (!this.mounted || !response) return;
    const now = SiteChangedElsewhereBar.scopeOf(response);
    this.tenants = TenantOption.fromList(response.tenants);
    this.now = SiteChangedElsewhereBar.same(now, this.opened) ? null : now;
  }

  private static scopeOf(response: any): { site: string | null; mode: string | null } {
    return { site: response?.current ?? null, mode: response?.mode ?? null };
  }

  private static same(a: { site: string | null; mode: string | null }, b: { site: string | null; mode: string | null }): boolean {
    return a.site === b.site && a.mode === b.mode;
  }

  /** "Platform", or the site's name followed by which console it is open in, when one was chosen. */
  private nameOf(scope: { site: string | null; mode: string | null }): string {
    if (scope.site === null) return AdminI18n.t('shell.site.platform');
    const site = this.tenants.find((tenant) => tenant.id === scope.site)?.label || scope.site;
    return scope.mode ? AdminI18n.t(`shell.siteChanged.mode.${scope.mode}`, { site }) : site;
  }

  /** Put the session back where this page was opened, then reload so nothing of the other site lingers. */
  private async goBack(): Promise<void> {
    const opened = this.opened;
    if (!opened) return;
    if (opened.site === null) {
      const failure = await TenantScopeClient.leaveAndReload();
      if (failure) this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('shell.site.switch'), failure);
      return;
    }
    const body = opened.mode ? { tenantId: opened.site, mode: opened.mode } : { tenantId: opened.site };
    const failure = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.TENANTS_SELECT, body)
      .then(() => null)
      .catch((error: unknown) => SidebarSiteItems.reasonFor(error));
    if (!failure) {
      window.location.reload();
      return;
    }
    this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('shell.site.switch'), failure);
  }

  render(): ReactNode {
    const now = this.now;
    const opened = this.opened;
    if (!now || !opened) return null;
    const button = 'inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20';
    return (
      <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 lg:px-8">
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <FrameworkIcons.Warning size={14} />
          <span>{AdminI18n.t('shell.siteChanged.text', { now: this.nameOf(now), opened: this.nameOf(opened) })}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => { void this.goBack(); }} className={button}>
            <FrameworkIcons.ArrowLeft size={13} />
            {AdminI18n.t('shell.siteChanged.back', { opened: this.nameOf(opened) })}
          </button>
          <button type="button" onClick={() => window.location.reload()} className={button}>
            <FrameworkIcons.Refresh size={13} />
            {AdminI18n.t('shell.siteChanged.continue', { now: this.nameOf(now) })}
          </button>
        </span>
      </div>
    );
  }
}
