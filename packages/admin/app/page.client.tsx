import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactElement } from 'react';
import { Slot } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { DashboardDataService } from '@/app/services/dashboard-data-service';
import { PlatformBrandingService } from '@/lib/platform-branding-service';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { AdminComponent } from '@/components/view/admin-component.client';
import { DashboardPageHeader } from '@/app/dashboard-page-header';
import { DashboardActivityChart } from '@/app/dashboard-activity-chart';
import { DashboardSystemPanel } from '@/app/dashboard-system-panel.client';
import { DashboardNeedsYou } from '@/app/dashboard-needs-you.client';
import { DashboardSitesPanel } from '@/app/dashboard-sites-panel.client';
import { DashboardRecentEdits } from '@/app/dashboard-recent-edits.client';
import { DashboardGettingStarted } from '@/app/dashboard-getting-started.client';
import { DashboardMissingConfig } from '@/app/dashboard-missing-config.client';
import { DashboardActivityBreakdown } from '@/app/dashboard-activity-breakdown';
import { DashboardUpdateAlert } from '@/app/dashboard-update-alert';
import { DashboardActivityFeed } from '@/app/dashboard-activity-feed';
import { DashboardSupportCard } from '@/app/dashboard-support-card';
import { DashboardFooter } from '@/app/dashboard-footer';
import { AdminPageKeys } from '@/lib/appearance/admin-page-keys';
import { state } from '@fromcode119/react-class-components';
import type { IPluginHealthCounts } from '@/app/plugins/health/interfaces/plugin-health-counts.interface';

export class AdminPage extends AdminComponent {
  private mounted = false;

  @state stats: any[] = [];
  @state activity: any[] = [];
  /** What this installation has and is missing — decides which face the dashboard shows. */
  @state installation: Record<string, any> | null = null;
  @state activePluginsCount = 0;
  @state loadingActivity = true;
  @state loadingStats = true;
  @state updateAvailable: any = null;
  /** Real plugin-registry counts behind the header status line; null until loaded or on failure. */
  @state health: IPluginHealthCounts | null = null;

  componentDidMount(): void {
    this.mounted = true;
    this.loadDashboard();
  }

  componentDidUpdate(): void {
    const prevAuth = this.prevAuthSnapshot;
    const prevRefresh = this.prevRefreshVersion;
    const auth = this.auth;
    const refreshVersion = this.runtime.plugins?.refreshVersion;

    const changed =
      prevAuth.isLoading !== auth?.isLoading ||
      prevAuth.user !== auth?.user ||
      prevRefresh !== refreshVersion;

    if (changed) {
      this.loadDashboard();
    }
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private prevAuthSnapshot: { isLoading: boolean; user: any } = { isLoading: true, user: null };
  private prevRefreshVersion: any = undefined;

  private loadDashboard(): void {
    const { user, isLoading: isAuthLoading } = this.auth;
    this.prevAuthSnapshot = { isLoading: isAuthLoading, user };
    this.prevRefreshVersion = this.runtime.plugins?.refreshVersion;

    if (isAuthLoading || !user) return;

    this.fetchStats();
    this.fetchPlugins();
    this.fetchActivity();
    this.fetchUpdate();
    this.fetchHealth();
  }

  /**
   * Permission check for role-protected dashboard controls. Admins (role 'admin' or '*') pass; otherwise
   * the user must hold the exact permission or a matching `<namespace>:*` wildcard.
   */
  private userHasPermission(user: any, required: string): boolean {
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    if (roles.includes('admin')) return true;
    const permissions: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
    return permissions.some(
      (p) => p === '*' || p === required || (p.endsWith(':*') && required.startsWith(p.slice(0, -1))),
    );
  }

  private async fetchStats(): Promise<void> {
    const sorted = await DashboardDataService.fetchStats();
    if (this.mounted && sorted) this.stats = sorted;
    if (this.mounted) this.loadingStats = false;
  }

  private async fetchPlugins(): Promise<void> {
    const count = await DashboardDataService.fetchPluginsCount();
    if (this.mounted && count !== null) this.activePluginsCount = count;
  }

  private async fetchActivity(): Promise<void> {
    try {
      const installation = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.INSTALLATION);
      if (this.mounted && installation) this.installation = installation;
    } catch {
      // Unreadable: fall through to the working board rather than claiming the install is empty.
    }
    const activity = await DashboardDataService.fetchActivity();
    if (this.mounted && activity) this.activity = activity;
    if (this.mounted) this.loadingActivity = false;
  }

  private async fetchUpdate(): Promise<void> {
    const updateAvailable = await DashboardDataService.fetchUpdate();
    if (this.mounted && updateAvailable) this.updateAvailable = updateAvailable;
  }

  /**
   * Plugin registry health for the header status line. On failure `health` stays null and the header
   * states nothing — it must never fall back to a cheerful default.
   *
   * Not asked for at all unless this account may act on the PLATFORM: the registry is the state of the
   * one container every site runs on, so the endpoint answers `platform_admin_required` to a site
   * administrator. Calling it anyway logged a failure on every dashboard load for a question that was
   * never this account's to ask.
   */
  private async fetchHealth(): Promise<void> {
    if (!PlatformAccess.canManagePlatform(this.auth.user)) return;
    const counts = await DashboardDataService.fetchPluginHealthCounts();
    if (this.mounted) this.health = counts;
  }

  render(): ReactElement {
    const DashboardOverride = this.pageBody(AdminPageKeys.DASHBOARD);
    if (DashboardOverride) {
      return <DashboardOverride />;
    }
    const { user } = this.auth;
    const { slots, settings } = this.runtime.plugins;
    const { activity, loadingActivity, updateAvailable, installation } = this;

    const platformName = PlatformBrandingService.resolvePlatformName(settings as Record<string, unknown> | null | undefined);

    const hasMainContent = slots['admin.dashboard.main'] && slots['admin.dashboard.main'].length > 0;


    return (
      <div className="w-full pb-24 animate-in fade-in duration-500">
        {/* Premium Dashboard Header */}
        <DashboardPageHeader user={user} theme={this.theme} health={this.health} />

        <div className="w-full px-6 lg:px-8 pt-6 space-y-6 pb-10">
          {/* Update Alert */}
          {updateAvailable && (
            <DashboardUpdateAlert
              updateAvailable={updateAvailable}
              onDismiss={() => { this.updateAvailable = null; }}
              onViewDetails={() => this.router.push(AdminConstants.ROUTES.SETTINGS.UPDATES)}
            />
          )}

          {/* Stats Grid */}
          {/* What needs the operator comes before anything that merely counts. Both render nothing
              when there is nothing to say. */}
          {/* Two faces, one dashboard. An installation with no theme and no plugins has nothing to
              report on, so it gets the steps that change that; everything else gets the working
              board. Both read the same checklist. */}
          {installation?.isFresh ? (
            <DashboardGettingStarted steps={installation.steps || []} mode={String(installation.mode || '')} storefront={String(installation.storefront || '')} />
          ) : (
            <>
              <DashboardNeedsYou />
              <DashboardSitesPanel />
            </>
          )}

          {installation?.missing ? <DashboardMissingConfig items={installation.missing} /> : null}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Slot name="admin.dashboard.top" />

              {/* What you were working on, before what there is a lot of. */}
              <DashboardRecentEdits />

              <div className="flex items-center gap-3">
                <div className="h-4 w-1 rounded-full bg-indigo-600 dark:bg-indigo-500/40"></div>
                <h3 className="text-[11px] font-bold tracking-tight text-slate-900/40 dark:text-slate-400 uppercase">Recent Activity</h3>
                <div className="h-px flex-1 bg-slate-200/60 dark:bg-slate-800"></div>
              </div>

              {/* Activity Section. "View All" used to open /plugins, which is not where these log
                  entries live — the Activity Log is the surface that lists them all. */}
              <DashboardActivityFeed
                activity={activity}
                loadingActivity={loadingActivity}
                hasMainContent={!!hasMainContent}
                onViewAll={() => this.router.push(AdminConstants.ROUTES.ACTIVITY)}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Slot name="admin.dashboard.widgets" />
              </div>
            </div>

            {/* Right Sidebar - Dynamic Content */}
            <div className="space-y-6">
              <DashboardActivityChart activity={activity} days={14} />

              {/* What the machine is doing, measured — see HostResourceService. */}
              <DashboardSystemPanel />

              <DashboardActivityBreakdown activity={activity} />

              <Slot name="admin.dashboard.sidebar" />

              <DashboardSupportCard onNavigateFramework={() => this.router.push(AdminConstants.ROUTES.SETTINGS.FRAMEWORK)} />
            </div>
          </div>
        </div>

        {/* Premium Footer */}
        <DashboardFooter platformName={platformName} />
      </div>
    );
  }
}
