import type { ReactElement } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AuthUtils } from '@/lib/auth-utils';
import type { TenantOption } from '@/lib/tenants/tenant-option';

/**
 * "Which site are you working in?" — the step between signing in and the admin, for an account that
 * can reach more than one and has picked none.
 *
 * It writes the SAME session claim the header switcher writes (`/auth/tenants/select`), so there is
 * one way a session enters a site and one place that checks membership. After selecting it reloads,
 * for the reason the switcher reloads: entering a site is a change of identity context, not a
 * client-side filter, and the previous scope's data must not survive it.
 *
 * Roles are deliberately not shown per row. What an account may do inside a site is decided by the
 * server from its membership for THAT site, and printing a guess here would be a second, quieter
 * answer to the same question.
 */
export class SiteChooser extends AdminComponent {
  @prop declare sites: TenantOption[];

  @state busy = '';
  @state failed = '';

  @bound
  private async choose(tenantId: string): Promise<void> {
    if (this.busy) return;
    this.busy = tenantId;
    this.failed = '';
    const ok = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.TENANTS_SELECT, { tenantId })
      .then(() => true)
      .catch(() => false);
    if (!ok) {
      this.busy = '';
      this.failed = tenantId;
      return;
    }
    window.location.reload();
  }

  @bound
  private signOut(): void {
    AuthUtils.purgeAuth();
    window.location.href = AdminConstants.ROUTES.AUTH.LOGIN;
  }

  private renderSite(site: TenantOption): ReactElement {
    const busy = this.busy === site.id;
    return (
      <button
        key={site.id}
        type="button"
        disabled={!!this.busy}
        onClick={() => this.choose(site.id)}
        className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50/40 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-indigo-500 dark:hover:bg-slate-900"
      >
        <FrameworkIcons.Globe size={15} className="shrink-0 text-indigo-500" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-white">{site.label}</span>
          <span className="block truncate text-[11px] text-slate-500">{site.primaryHost}</span>
        </span>
        {this.failed === site.id ? <span className="text-[11px] font-semibold text-rose-500">Not available</span> : null}
        {busy ? null : <FrameworkIcons.ChevronRight size={14} className="shrink-0 text-slate-400" />}
      </button>
    );
  }

  /** Signed in, member of nothing. Said plainly, rather than an admin whose every screen refuses. */
  private get isEmpty(): boolean {
    return this.sites.length === 0;
  }

  render(): ReactElement {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-[#020617]">
        <div className="w-full max-w-md space-y-5">
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {this.isEmpty ? 'No site access' : 'Choose a site'}
            </h1>
            <p className="text-[12px] leading-relaxed text-slate-500">
              You're signed in as <span className="font-semibold text-indigo-500">{this.auth.user?.email}</span>.{' '}
              {this.isEmpty
                ? 'Your account is not a member of any site yet, so there is nothing here to administer. A platform admin can add you to one.'
                : 'What you can do is decided per site, so pick the one you want to work in. You can switch at any time from the header.'}
            </p>
          </div>
          <div className="space-y-2">{this.sites.map((site) => this.renderSite(site))}</div>
          <button
            type="button"
            onClick={this.signOut}
            className="w-full text-[11px] font-semibold tracking-wide text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }
}
