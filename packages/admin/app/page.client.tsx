import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactElement } from 'react';
import { Slot } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { DashboardDataService } from '@/app/services/dashboard-data-service';
import { PlatformBrandingService } from '@/lib/platform-branding-service';
import { AdminComponent } from '@/components/view/admin-component.client';
import { DashboardPageHeader } from '@/app/dashboard-page-header';
import { DashboardStatsGrid } from '@/app/dashboard-stats-grid';
import { DashboardQuickActions } from '@/app/dashboard-quick-actions';
import { DashboardActivityChart } from '@/app/dashboard-activity-chart';
import { DashboardActivityBreakdown } from '@/app/dashboard-activity-breakdown';
import { DashboardUpdateAlert } from '@/app/dashboard-update-alert';
import { DashboardCollectionsGrid } from '@/app/dashboard-collections-grid';
import { DashboardActivityFeed } from '@/app/dashboard-activity-feed';
import { DashboardSupportCard } from '@/app/dashboard-support-card';
import { DashboardFooter } from '@/app/dashboard-footer';
import { AdminPageKeys } from '@/lib/appearance/admin-page-keys';
import { state } from '@fromcode119/reactor';

export class AdminPage extends AdminComponent {
  private mounted = false;

  @state stats: any[] = [];
  @state activity: any[] = [];
  @state activePluginsCount = 0;
  @state loadingActivity = true;
  @state loadingStats = true;
  @state updateAvailable: any = null;
  @state showAllCollections = false;

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
    const activity = await DashboardDataService.fetchActivity();
    if (this.mounted && activity) this.activity = activity;
    if (this.mounted) this.loadingActivity = false;
  }

  private async fetchUpdate(): Promise<void> {
    const updateAvailable = await DashboardDataService.fetchUpdate();
    if (this.mounted && updateAvailable) this.updateAvailable = updateAvailable;
  }

  render(): ReactElement {
    const DashboardOverride = this.pageBody(AdminPageKeys.DASHBOARD);
    if (DashboardOverride) {
      return <DashboardOverride />;
    }
    const { user } = this.auth;
    const { slots, settings } = this.runtime.plugins;
    const { stats, activity, activePluginsCount, loadingActivity, loadingStats, updateAvailable, showAllCollections } = this;

    const platformName = PlatformBrandingService.resolvePlatformName(settings as Record<string, unknown> | null | undefined);

    const hasMainContent = slots['admin.dashboard.main'] && slots['admin.dashboard.main'].length > 0;

    const userStats = stats.find(s => s.slug === 'users');
    const userCount = userStats ? String(userStats.count) : '0';

    return (
      <div className="w-full pb-24 animate-in fade-in duration-500">
        {/* Premium Dashboard Header */}
        <DashboardPageHeader user={user} theme={this.theme} />

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
          <DashboardStatsGrid userCount={userCount} loadingStats={loadingStats} activePluginsCount={activePluginsCount} />

          {/* Quick Actions — each card is a role-protected resource; only show the ones this user is
              actually permitted to use (admins hold '*', scoped staff hold their plugin permissions). */}
          {(() => {
            const quickActions = [
              { label: 'Create User', href: '/users/new', icon: 'Users', permission: 'users:manage' },
              { label: 'Media Library', href: '/media', icon: 'Image', permission: 'media:manage' },
              { label: 'Plugins', href: '/plugins', icon: 'Package', permission: 'plugins:manage' },
              { label: 'Themes', href: '/themes', icon: 'Layout', permission: 'themes:manage' },
              { label: 'Settings', href: AdminConstants.ROUTES.SETTINGS.ROOT, icon: 'Settings', permission: 'settings:manage' },
              { label: 'Activity Log', href: AdminConstants.ROUTES.ACTIVITY, icon: 'Activity', permission: 'system:view' },
            ].filter((a) => this.userHasPermission(user, a.permission));
            if (!quickActions.length) return null;
            return (
              <DashboardQuickActions
                actions={quickActions.map(({ label, href, icon }) => ({ label, href, icon }))}
                onNavigate={(href) => this.router.push(href)}
              />
            );
          })()}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Slot name="admin.dashboard.top" />

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-4 w-1 rounded-full bg-indigo-600 dark:bg-indigo-500/40"></div>
                  <h3 className="text-[11px] font-bold tracking-tight text-slate-900/40 dark:text-slate-400 uppercase">Content Collections</h3>
                  <div className="h-px flex-1 bg-slate-200/60 dark:bg-slate-800"></div>
                </div>
                <Button
                  variant={ButtonVariant.GHOST}
                  size={FieldSize.SM}
                  onClick={() => { this.showAllCollections = !showAllCollections; }}
                  className="text-[10px] whitespace-nowrap font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase"
                >
                  {showAllCollections ? 'Show Less' : 'View All'}
                </Button>
              </div>

              {/* Main Resources Grid */}
              <DashboardCollectionsGrid
                stats={stats}
                showAllCollections={showAllCollections}
                onNavigate={(path) => this.router.push(path)}
              />

              <div className="flex items-center gap-3">
                <div className="h-4 w-1 rounded-full bg-indigo-600 dark:bg-indigo-500/40"></div>
                <h3 className="text-[11px] font-bold tracking-tight text-slate-900/40 dark:text-slate-400 uppercase">Recent Activity</h3>
                <div className="h-px flex-1 bg-slate-200/60 dark:bg-slate-800"></div>
              </div>

              {/* Activity Section */}
              <DashboardActivityFeed
                activity={activity}
                loadingActivity={loadingActivity}
                hasMainContent={!!hasMainContent}
                onViewAll={() => this.router.push('/plugins')}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Slot name="admin.dashboard.widgets" />
              </div>
            </div>

            {/* Right Sidebar - Dynamic Content */}
            <div className="space-y-6">
              <DashboardActivityChart activity={activity} days={14} />

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
