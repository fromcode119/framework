import type { ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { PluginProcessHost, ThemeMode } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { PluginDetailPageService } from '@/app/plugins/[slug]/plugin-detail-page-service';
import { PluginProcessFormat } from '@/app/plugins/[slug]/components/view/process/plugin-process-format';
import { PluginProcessRegistrations } from '@/app/plugins/[slug]/components/view/process/plugin-process-registrations.client';
import type { IPluginRuntimeResponse } from '@/app/plugins/[slug]/interfaces/plugin-runtime-response.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The plugin's process as it is RIGHT NOW: where it runs and what a deploy of that container does to it,
 * as which OS user, how much memory it holds against its limit, and everything it registered.
 *
 * Live state, not a setting — so it loads itself and has a Refresh. Every blank is explained: a plugin
 * that runs inside the api has no process, one that is stopped says so, and one that did not answer
 * shows why rather than an empty list.
 */
export class PluginProcessCard extends AdminComponent {
  @prop declare slug: string;
  @state loading = true;
  @state data: IPluginRuntimeResponse | null = null;
  @state loadError = '';

  async componentDidMount(): Promise<void> {
    await this.load();
  }

  @bound
  async load(): Promise<void> {
    this.loading = true;
    try {
      this.data = await PluginDetailPageService.fetchRuntime(this.slug);
      this.loadError = '';
    } catch (err: any) {
      this.loadError = err?.message || AdminI18n.t('plugins.detail.thePluginProcessCouldNot');
    } finally {
      this.loading = false;
    }
  }

  private row(icon: ReactNode, title: string, value: ReactNode, description?: string): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
        <div className="flex gap-4">
          <div className={`p-2.5 rounded-xl h-fit ${dark ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>{icon}</div>
          <div>
            <h3 className={`font-semibold text-sm ${dark ? 'text-slate-200' : 'text-slate-900'}`}>{title}</h3>
            {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
          </div>
        </div>
        <div className={`text-sm md:text-right ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{value}</div>
      </div>
    );
  }

  /**
   * In the extension-host a plugin's process carries over when the api restarts or deploys (the new api
   * takes it over); started by the api itself, it goes with the api.
   */
  private whereItRuns(inExtensionHost: boolean, sandboxed: boolean, kernel: string | null): ReactNode {
    if (sandboxed) {
      // Said as measured: the kernel the sandbox host sees is gVisor's own only when gVisor runs it.
      const runtime = String(kernel ?? '').toLowerCase().includes('gvisor')
        ? AdminI18n.t('plugins.process.sandboxGvisor', { kernel: kernel ?? '' })
        : AdminI18n.t('plugins.process.sandboxNoRuntime', { kernel: kernel ?? '?' });
      return this.row(<FrameworkIcons.Shield size={20} />, AdminI18n.t('plugins.process.where'), AdminI18n.t('plugins.process.ownInSandbox'), `${AdminI18n.t('plugins.process.ownInSandboxHint')} ${runtime}`);
    }
    return inExtensionHost
      ? this.row(<FrameworkIcons.Server size={20} />, AdminI18n.t('plugins.process.where'), AdminI18n.t('plugins.process.ownInHost'), AdminI18n.t('plugins.process.ownInHostHint'))
      : this.row(<FrameworkIcons.Server size={20} />, AdminI18n.t('plugins.process.where'), AdminI18n.t('plugins.process.ownByApi'), AdminI18n.t('plugins.process.ownByApiHint'));
  }

  private body(): ReactNode {
    if (this.loadError) return <p className="text-sm text-[var(--destructive)]">{this.loadError}</p>;
    if (!this.data) return <p className="text-sm text-slate-500">{AdminI18n.t('plugins.detail.readingThePluginProcess')}</p>;
    if (!this.data.isolated || !this.data.runtime) {
      return this.row(<FrameworkIcons.Server size={20} />, AdminI18n.t('plugins.process.where'), AdminI18n.t('plugins.process.inApi'), AdminI18n.t('plugins.process.inApiHint'));
    }
    const runtime = this.data.runtime;
    const report = runtime.report;
    return (
      <div className="space-y-4">
        {this.whereItRuns(runtime.hostedBy === String(PluginProcessHost.EXTENSION_HOST.value), runtime.pool === 'site', runtime.hostKernel)}
        {runtime.hostUnavailable && <p className="text-sm text-[var(--destructive)]">{AdminI18n.t('plugins.process.hostUnavailable', { reason: runtime.hostUnavailable })}</p>}
        {!runtime.running && <p className="text-sm text-amber-600 dark:text-amber-400">{AdminI18n.t('plugins.detail.notRunningThePluginIs')}</p>}
        {runtime.running && this.row(<FrameworkIcons.Terminal size={20} />, AdminI18n.t('plugins.detail.process'), `pid ${runtime.pid}${runtime.pool === 'site' ? ` ${AdminI18n.t('plugins.process.inSandboxHost')}` : runtime.hostedBy === String(PluginProcessHost.EXTENSION_HOST.value) ? ` ${AdminI18n.t('plugins.process.inExtensionHost')}` : ''} · ${runtime.uid !== null ? AdminI18n.t('plugins.process.osUser', { uid: runtime.uid }) : AdminI18n.t('plugins.process.sameOsUser')}`, runtime.uid !== null ? undefined : AdminI18n.t('plugins.process.noSpawner'))}
        {report && this.row(<FrameworkIcons.Zap size={20} />, AdminI18n.t('dashboard.systemPanel.memory'), AdminI18n.t('plugins.process.memory', { rss: PluginProcessFormat.megabytes(report.memory.rssBytes), heap: PluginProcessFormat.megabytes(report.memory.heapUsedBytes), limit: runtime.limits.memoryMb }))}
        {report && this.row(<FrameworkIcons.Clock size={20} />, AdminI18n.t('plugins.process.upFor'), AdminI18n.t('plugins.process.uptime', { uptime: PluginProcessFormat.duration(report.uptimeSeconds), node: report.nodeVersion, protocol: report.protocolVersion }), AdminI18n.t('plugins.process.timeoutHint', { timeout: runtime.limits.timeoutMs }))}
        {this.row(<FrameworkIcons.Refresh size={20} />, AdminI18n.t('plugins.process.restarts'), String(runtime.recentRestarts), AdminI18n.t('plugins.process.restartsHint'))}
        {runtime.reportError && <p className="text-sm text-[var(--destructive)]">{AdminI18n.t('plugins.process.noAnswer', { reason: runtime.reportError })}</p>}
        {report && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <h3 className="font-semibold text-sm">{AdminI18n.t('plugins.detail.registeredWithTheApi')}</h3>
            <PluginProcessRegistrations registrations={report.registrations} />
          </div>
        )}
      </div>
    );
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <Card title={AdminI18n.t('plugins.detail.process')} className={`border-0 p-5 ${dark ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
        <div className="flex justify-end -mt-2 mb-3">
          <Button onClick={this.load} isLoading={this.loading} icon={<FrameworkIcons.Refresh size={13} />}>{AdminI18n.t('plugins.detail.refresh')}</Button>
        </div>
        {this.body()}
      </Card>
    );
  }
}
