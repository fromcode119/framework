import type { ChangeEvent, ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import type { ISitePluginQuota } from '@/app/plugins/installed/interfaces/site-plugin-quota.interface';
import type { ISiteOwnPlugin } from '@/app/plugins/installed/interfaces/site-own-plugin.interface';

/**
 * In a site: the plugins it uploaded itself — an upload of its own, a switch for each, and removing one.
 *
 * The upload is offered only when the platform allows it AND the server can run a plugin under its own
 * user; otherwise the panel says which of the two is missing, rather than offering a button that fails.
 */
export class SiteOwnPlugins extends AdminComponent {
  @state quota: ISitePluginQuota | null = null;
  @state own: ISiteOwnPlugin[] = [];
  @state loadError = '';
  @state busy: string | null = null;
  @state uploadPercent: number | null = null;
  private fileInput: HTMLInputElement | null = null;

  async componentDidMount(): Promise<void> {
    await this.load();
  }

  @bound
  async load(): Promise<void> {
    try {
      const [quota, offered] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.MINE_QUOTA),
        AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.OFFERED),
      ]);
      this.quota = quota;
      this.own = offered?.own ?? [];
      this.loadError = '';
    } catch (err: any) {
      this.loadError = err?.message || 'This site\'s own plugins could not be read.';
    }
  }

  @bound
  pickFile(): void {
    this.fileInput?.click();
  }

  @bound
  async onFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    this.busy = 'upload';
    this.uploadPercent = 0;
    try {
      const form = new FormData();
      form.append('plugin', file);
      const answer = await AdminApi.upload(AdminConstants.ENDPOINTS.PLUGINS.MINE_UPLOAD, form, { onProgress: (progress: any) => { this.uploadPercent = progress?.percent ?? null; } });
      this.runtime.notify.notify(NotificationType.SUCCESS, 'Plugin Uploaded', `${answer?.name || answer?.slug} is installed for this site. Switch it on below.`);
      await this.load();
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, 'Not Uploaded', err?.message || 'The plugin could not be uploaded.');
    } finally {
      this.busy = null;
      this.uploadPercent = null;
    }
  }

  @bound
  async toggle(slug: string, enabled: boolean): Promise<void> {
    this.busy = slug;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.SITE(slug), { enabled });
      this.own = this.own.map((plugin) => (plugin.slug === slug ? { ...plugin, enabledHere: enabled } : plugin));
      this.runtime.plugins.triggerRefresh();
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, 'Not Changed', err?.message || 'The plugin could not be switched.');
    } finally {
      this.busy = null;
    }
  }

  @bound
  async remove(slug: string): Promise<void> {
    if (!confirm(`Remove "${slug}" from this site? Its files are deleted; its settings and data stay until the site is removed.`)) return;
    this.busy = slug;
    try {
      await AdminApi.delete(AdminConstants.ENDPOINTS.PLUGINS.MINE_DELETE(slug));
      this.runtime.plugins.triggerRefresh();
      await this.load();
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, 'Not Removed', err?.message || 'The plugin could not be removed.');
    } finally {
      this.busy = null;
    }
  }

  private uploadNote(quota: ISitePluginQuota): string {
    if (!quota.enabled) return 'The platform does not allow sites to upload their own plugins.';
    if (!quota.isolated) return 'This server cannot run a plugin under its own user, so it does not accept one from a site.';
    const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));
    return `Only this site runs it, in its own process, with no database schema, network or admin screens. `
      + `This site holds ${quota.plugins} of ${quota.maxPlugins} plugins, ${megabytes(quota.usedBytes)} of ${megabytes(quota.maxBytes)} MB — limits the platform sets.`;
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    const quota = this.quota;
    const canUpload = Boolean(quota?.enabled && quota?.isolated);
    return (
      <Card className={`border-0 p-4 ${AdminClass.SURFACE} ${dark ? 'bg-slate-900/40' : 'bg-white shadow-sm'}`}>
        <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>This site's own plugins</h3>
        {this.loadError ? <p className="text-xs text-rose-500">{this.loadError}</p> : null}
        {quota ? <p className="text-xs text-slate-500 mb-4">{this.uploadNote(quota)}</p> : null}
        {canUpload ? (
          <div onClick={this.pickFile} className={`mb-4 cursor-pointer rounded-xl border-2 border-dashed px-4 py-4 transition-all ${dark ? 'border-slate-700 bg-slate-900/30 hover:border-slate-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <input type="file" ref={(element) => { this.fileInput = element; }} onChange={this.onFile} className="hidden" accept=".zip,application/zip" />
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3"><FrameworkIcons.Upload size={18} className="text-slate-400" /><p className={`text-sm font-medium ${dark ? 'text-slate-200' : 'text-slate-700'}`}>Upload a plugin for this site: click to choose a `.zip`.</p></div>
              <button type="button" disabled={this.busy !== null} className="flex items-center justify-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold uppercase tracking-wider text-[11px] transition-all active:scale-[0.98] shadow-sm disabled:opacity-50">{this.busy === 'upload' ? <FrameworkIcons.Loader className="animate-spin" size={16} /> : <FrameworkIcons.Plus size={16} strokeWidth={2.5} />}<span>Upload for this site</span></button>
            </div>
            {this.uploadPercent !== null ? <p className="mt-2 text-xs text-slate-500">Uploading… {this.uploadPercent}%</p> : null}
          </div>
        ) : null}
        {this.own.length === 0 ? (quota ? <p className="text-xs text-slate-500">This site has no plugins of its own.</p> : null) : (
          <div className="space-y-4">
            {this.own.map((plugin) => (
              <div key={plugin.slug} className="flex items-start justify-between gap-4">
                <Switch
                  checked={plugin.enabledHere}
                  disabled={this.busy !== null || !plugin.running}
                  onChange={(enabled: boolean) => this.toggle(plugin.slug, enabled)}
                  label={`${plugin.name} · v${plugin.version}`}
                  description={plugin.running ? plugin.description : 'Not running on the server — see the plugin\'s error before switching it on.'}
                />
                <button type="button" onClick={() => this.remove(plugin.slug)} disabled={this.busy !== null} className="text-xs font-semibold text-rose-500 hover:text-rose-600 disabled:opacity-50">Remove</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }
}
