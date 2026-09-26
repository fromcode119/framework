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
      this.loadError = err?.message || 'The plugin process could not be read.';
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
  private whereItRuns(inExtensionHost: boolean): ReactNode {
    return inExtensionHost
      ? this.row(<FrameworkIcons.Server size={20} />, 'Where it runs', 'Its own process, in the extension-host container', 'Carried over when the api restarts or deploys. A new process starts when the plugin is updated, or when the extension-host itself restarts.')
      : this.row(<FrameworkIcons.Server size={20} />, 'Where it runs', 'Its own process, started by the api container', 'Restarting or deploying the api restarts this process too.');
  }

  private body(): ReactNode {
    if (this.loadError) return <p className="text-sm text-[var(--destructive)]">{this.loadError}</p>;
    if (!this.data) return <p className="text-sm text-slate-500">Reading the plugin process…</p>;
    if (!this.data.isolated || !this.data.runtime) {
      return this.row(<FrameworkIcons.Server size={20} />, 'Where it runs', 'Inside the api process', 'This plugin is not isolated, so it has no process of its own: it runs, restarts and deploys with the api.');
    }
    const runtime = this.data.runtime;
    const report = runtime.report;
    return (
      <div className="space-y-4">
        {this.whereItRuns(runtime.hostedBy === String(PluginProcessHost.EXTENSION_HOST.value))}
        {runtime.hostUnavailable && <p className="text-sm text-[var(--destructive)]">The extension-host container could not be reached, so plugin processes cannot start: {runtime.hostUnavailable}</p>}
        {!runtime.running && <p className="text-sm text-amber-600 dark:text-amber-400">Not running. The plugin is inactive, or its process stopped and is being restarted.</p>}
        {runtime.running && this.row(<FrameworkIcons.Terminal size={20} />, 'Process', `pid ${runtime.pid}${runtime.hostedBy === String(PluginProcessHost.EXTENSION_HOST.value) ? ' in the extension-host container' : ''}${runtime.uid !== null ? ` · OS user ${runtime.uid}` : ' · same OS user as the api'}`, runtime.uid !== null ? undefined : 'No privileged spawner here (typical for local development), so the process is not separated by OS user.')}
        {report && this.row(<FrameworkIcons.Zap size={20} />, 'Memory', `${PluginProcessFormat.megabytes(report.memory.rssBytes)} resident · heap ${PluginProcessFormat.megabytes(report.memory.heapUsedBytes)} of ${runtime.limits.memoryMb} MB limit`)}
        {report && this.row(<FrameworkIcons.Clock size={20} />, 'Up for', `${PluginProcessFormat.duration(report.uptimeSeconds)} · Node ${report.nodeVersion} · plugin protocol ${report.protocolVersion}`, `Requests that take longer than ${runtime.limits.timeoutMs} ms are failed and the process restarted.`)}
        {this.row(<FrameworkIcons.Refresh size={20} />, 'Recent restarts', String(runtime.recentRestarts), 'Counted until the process has been healthy for a minute; more than 3 in a row disables the plugin.')}
        {runtime.reportError && <p className="text-sm text-[var(--destructive)]">The process is running but did not answer: {runtime.reportError}</p>}
        {report && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <h3 className="font-semibold text-sm">Registered with the api</h3>
            <PluginProcessRegistrations registrations={report.registrations} />
          </div>
        )}
      </div>
    );
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <Card title="Process" className={`border-0 p-5 ${dark ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
        <div className="flex justify-end -mt-2 mb-3">
          <Button onClick={this.load} isLoading={this.loading} icon={<FrameworkIcons.Refresh size={13} />}>Refresh</Button>
        </div>
        {this.body()}
      </Card>
    );
  }
}
