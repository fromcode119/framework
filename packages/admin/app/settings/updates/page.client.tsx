import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Loader } from '@/components/ui/view/loader.client';
import { Badge } from '@/components/ui/view/badge.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { FrameworkIcons } from '@fromcode119/react';
import { AppEnv } from '@/lib/env';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminClass } from '@/lib/admin-class';

export class UpdatesPage extends AdminComponent {
  @state status: any = null;
  @state loading = true;
  @state updating = false;
  @state showConfirm = false;
  /**
   * Set when the registry check FAILED, or answered without a `latest`.
   *
   * "We could not check" used to render as "you are current": `latestVersion` fell back to the
   * installed version and the badge went green "Framework Up to Date". An unreachable registry now
   * says so and the badge stays neutral.
   */
  @state checkError: string | null = null;

  async componentDidMount(): Promise<void> {
    await this.fetchStatus();
  }

  private get notify(): (type: any, title: string, message: string) => void {
    return this.runtime.notify.notify;
  }

  private get installedVersion(): string {
    return String(this.status?.current || AppEnv.APP_VERSION || '').trim();
  }

  /** The registry's answer, or `''` when it did not give one. NEVER the installed version. */
  private get latestVersion(): string {
    return String(this.status?.latest ?? '').trim();
  }

  /** True only when the registry answered AND named a different version. */
  private get hasUpdate(): boolean {
    return Boolean(this.status?.hasUpdate && this.latestVersion && this.latestVersion !== this.installedVersion);
  }

  /** True when we do not know what the latest version is — distinct from "you are up to date". */
  private get latestVersionUnknown(): boolean {
    return Boolean(this.checkError) || !this.latestVersion;
  }

  @bound
  async fetchStatus(): Promise<void> {
    this.loading = true;
    this.checkError = null;
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.UPDATE_CHECK);
      this.status = data;
    } catch (err: any) {
      const message = err?.message || 'The framework registry could not be reached.';
      this.status = null;
      this.checkError = message;
      this.notify(NotificationType.ERROR, 'Update Check Failed', message);
    } finally {
      this.loading = false;
    }
  }

  @bound
  async handleUpdate(): Promise<void> {
    this.updating = true;
    try {
      this.notify(NotificationType.INFO, 'Update Started', 'Creating system backup and applying updates. This may take a minute.');
      const data = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.UPDATE_APPLY);
      this.notify(NotificationType.SUCCESS, 'Update Complete', `System updated to v${data.version}. The page will now refresh.`);
      this.showConfirm = false;

      // Wait a bit for the notify to be seen and for potential server restart
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (err: any) {
      this.notify(NotificationType.ERROR, 'Update Failed', err.message);
      this.updating = false;
    }
  }

  @bound
  openConfirm(): void {
    this.showConfirm = true;
  }

  @bound
  closeConfirm(): void {
    this.showConfirm = false;
  }

  render(): ReactNode {
    const theme = this.theme;
    const loading = this.loading;
    const updating = this.updating;
    const status = this.status;

    if (loading && !status) return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
         <Loader label="Checking the update registry..." />
      </div>
    );

    const installedVersion = this.installedVersion;
    const latestVersion = this.latestVersion;
    const hasUpdate = this.hasUpdate;
    const latestVersionUnknown = this.latestVersionUnknown;

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.System size={18} strokeWidth={2} />}
          title="System Updates"
          subtitle="Framework core & registry synchronization"
          actions={
            <button
              onClick={this.fetchStatus}
              disabled={loading}
              className={`flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-semibold tracking-tight transition-all active:scale-95 ${
                theme === ThemeMode.DARK
                  ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <FrameworkIcons.Loader className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Verifying Registry...' : 'Check For Updates'}
            </button>
          }
        />

        <div className="p-6 w-full space-y-6 pb-10">
          <Card className={`p-6 border-0 ${AdminClass.SURFACE} overflow-hidden relative ${theme === ThemeMode.DARK ? 'bg-slate-900/40 ring-1 ring-white/5' : 'bg-white shadow-sm'}`}>
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[80px] -translate-y-1/2 translate-x-1/2 rounded-full" />

            <div className="flex flex-col xl:flex-row items-start gap-6 relative">
              <div className={`h-16 w-16 rounded-xl flex items-center justify-center shrink-0 ${theme === ThemeMode.DARK ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600'}`}>
                <FrameworkIcons.System size={32} strokeWidth={1.5} />
              </div>

              <div className="flex-1 space-y-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className={`text-2xl font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>Fromcode Core Engine</h2>
                    <Badge
                      variant={hasUpdate ? 'warning' : latestVersionUnknown ? 'gray' : 'success'}
                      className="px-3 py-1 text-[10px] font-bold tracking-tight rounded-full"
                    >
                      {hasUpdate ? 'Update Available' : latestVersionUnknown ? 'Update Check Failed' : 'Framework Up to Date'}
                    </Badge>
                  </div>

                  <p className={`text-sm leading-relaxed max-w-2xl ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
                    The core engine powers all API, Database, and Plugin infrastructure. Keeping it updated ensures
                    the highest security, stability, and performance for your enterprise platform.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className={`p-4 rounded-xl border ${theme === ThemeMode.DARK ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100/80'}`}>
                    <div className="text-[10px] font-bold tracking-tight text-slate-400 mb-2">Installed Version</div>
                    <div className={`font-mono font-bold text-2xl ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-700'}`}>{installedVersion ? `v${installedVersion}` : '-'}</div>
                  </div>
                  <div className={`p-4 rounded-xl border ${theme === ThemeMode.DARK ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100/80'}`}>
                    <div className="text-[10px] font-bold tracking-tight text-slate-400 mb-2">Latest Registry Version</div>
                    {/* NEVER echo the installed version here. That is what made an unreachable
                        registry look like "you are current". */}
                    <div className={`font-mono font-bold text-2xl ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-700'}`}>{latestVersionUnknown ? 'Unknown' : `v${latestVersion}`}</div>
                  </div>
                </div>

                {latestVersionUnknown && (
                  <p className="text-[11px] font-medium leading-relaxed text-rose-500">
                    {this.checkError || 'The registry did not report a latest version, so whether an update exists is unknown.'}
                  </p>
                )}

                {hasUpdate && (
                  <div className={`mt-5 p-5 rounded-xl border ${theme === ThemeMode.DARK ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center gap-2.5 text-amber-600 font-semibold tracking-tight mb-2">
                      <div className="p-1.5 bg-amber-500/10 rounded-lg">
                        <FrameworkIcons.Warning size={18} />
                      </div>
                      <span>v{latestVersion} Recommended Update</span>
                    </div>
                    {/* A hardcoded paragraph sat here — "cumulative improvements to the plugin
                        isolation layer and enhanced database driver stability" — shown verbatim as
                        the release notes for EVERY version. `SystemUpdateService.checkUpdate()`
                        returns only current/latest/hasUpdate/downloadUrl/lastUpdated; no release
                        notes exist anywhere in the payload, so the operator was making an
                        "should I update?" decision on invented changelog text. Removed. Re-add a
                        real paragraph only when the marketplace core payload carries release notes. */}
                    <button
                      onClick={this.openConfirm}
                      disabled={updating}
                      className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold tracking-tight text-xs transition-colors shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      {updating ? 'Applying Update...' : 'Install Core v' + latestVersion}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {status?.lastUpdated && (
            <div className="text-center text-[10px] font-bold tracking-tight text-slate-500 opacity-40">
              Last Registry Sync: {new Date(status.lastUpdated).toLocaleString()}
            </div>
          )}

          <ConfirmDialog
            isOpen={this.showConfirm}
            onClose={this.closeConfirm}
            onConfirm={this.handleUpdate}
            isLoading={updating}
            title="Apply System Update?"
            description={`You are about to update Fromcode Core from v${installedVersion} to v${latestVersion}. A complete system backup will be created automatically before proceeding. This process will overwrite system files and may cause a temporary service disruption while the server restarts.`}
          />
        </div>
      </div>
    );
  }
}
