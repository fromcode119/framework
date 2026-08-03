import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { Reactor, prop, Ref } from '@fromcode119/reactor';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { DependencyDialog } from '@/components/ui/view/dependency-dialog.client';
import { FrameworkIcons } from '@fromcode119/react';
import { PluginState } from '@fromcode119/core/client';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { Loader } from '@/components/ui/view/loader.client';
import { UploadPreviewDialog } from '@/components/ui/view/upload-preview-dialog.client';
import { InstalledPluginCard } from '@/app/plugins/installed/components/view/installed-plugin-card.client';
import { IDependencyIssue } from '@/components/ui/interfaces/dependency-issue.interface';
import { IUploadPreviewSection } from '@/components/ui/interfaces/upload-preview-section.interface';
import { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';
import { AdminClass } from '@/lib/admin-class';

export class InstalledPluginsView extends Reactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<InstalledPluginsView, 'closeDeleteConfirm' | 'closeDependencyConfirm' | 'closeUploadPreview' | 'confirmUploadPreview' | 'deleteConfirmDescription' | 'dependencyIssues' | 'failedPluginsCount' | 'heldPluginsCount' | 'onReapproveAll' | 'filteredPlugins' | 'fileInputRef' | 'handleDragLeave' | 'handleDragOver' | 'handleDrop' | 'handleFileChange' | 'hasPluginUpdate' | 'handleToggle' | 'handleUploadClick' | 'imageErrors' | 'isActivating' | 'isDeleting' | 'isDropActive' | 'isInspectingUpload' | 'isUploading' | 'loading' | 'operationStatus' | 'markImageError' | 'onDeleteConfirm' | 'onDeletePrompt' | 'searchQuery' | 'setSearchQuery' | 'showDeleteConfirm' | 'showDependencyConfirm' | 'showUploadPreview' | 'targetPlugin' | 'theme' | 'toggleDependencies' | 'uploadProgressLabel' | 'uploadProgressPercent' | 'uploadPreviewDescription' | 'uploadPreviewSections' | 'uploadPreviewTitle'>;

  @prop declare closeDeleteConfirm: () => void;
  @prop declare closeDependencyConfirm: () => void;
  @prop declare closeUploadPreview: () => void;
  @prop declare confirmUploadPreview: () => Promise<void>;
  @prop declare deleteConfirmDescription: string;
  @prop declare dependencyIssues: IDependencyIssue[];
  @prop declare failedPluginsCount: number;
  @prop declare heldPluginsCount: number;
  @prop declare onReapproveAll: () => Promise<void>;
  @prop declare filteredPlugins: ILoadedPlugin[];
  @prop declare fileInputRef: Ref<HTMLInputElement>;
  @prop declare handleDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  @prop declare handleDragOver: (event: DragEvent<HTMLDivElement>) => void;
  @prop declare handleDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>;
  @prop declare handleFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  @prop declare hasPluginUpdate: (plugin: ILoadedPlugin) => boolean;
  @prop declare handleToggle: (slug: string, currentEnabled: boolean, options?: { force?: boolean; recursive?: boolean }) => Promise<void>;
  @prop declare handleUploadClick: () => void;
  @prop declare imageErrors: Record<string, boolean>;
  @prop declare isActivating: boolean;
  @prop declare isDeleting: boolean;
  @prop declare isDropActive: boolean;
  @prop declare isInspectingUpload: boolean;
  @prop declare isUploading: boolean;
  @prop declare loading: boolean;
  @prop declare operationStatus: IPluginInstallOperation | null;
  @prop declare markImageError: (slug: string) => void;
  @prop declare onDeleteConfirm: () => Promise<void>;
  @prop declare onDeletePrompt: (slug: string) => void;
  @prop declare searchQuery: string;
  @prop declare setSearchQuery: (value: string) => void;
  @prop declare showDeleteConfirm: boolean;
  @prop declare showDependencyConfirm: boolean;
  @prop declare showUploadPreview: boolean;
  @prop declare targetPlugin: string | null;
  @prop declare theme: ThemeMode;
  @prop declare toggleDependencies: (recursive: boolean, force: boolean) => Promise<void>;
  @prop declare uploadProgressLabel: string | null;
  @prop declare uploadProgressPercent: number | null;
  @prop declare uploadPreviewDescription: string;
  @prop declare uploadPreviewSections: IUploadPreviewSection[];
  @prop declare uploadPreviewTitle: string;

  render(): ReactNode {
  const theme = this.theme;
  const filteredPlugins = this.filteredPlugins;
  const hasPluginUpdate = this.hasPluginUpdate;
  const failedPluginsCount = this.failedPluginsCount;
  const isDark = theme === ThemeMode.DARK;
  const activeCount = filteredPlugins.filter((p) => p.state === PluginState.ACTIVE && !p.error).length;
  const inactiveCount = filteredPlugins.filter((p) => p.state !== PluginState.ACTIVE && !(Boolean(p.error) || p.state === PluginState.ERROR)).length;
  const updateCount = filteredPlugins.filter((p) => hasPluginUpdate(p)).length;
  const summaryStats: Array<{ label: string; value: number; tone: string }> = [
    { label: 'Total', value: filteredPlugins.length, tone: isDark ? 'text-white' : 'text-slate-900' },
    { label: 'Active', value: activeCount, tone: 'text-emerald-500' },
    { label: 'Inactive', value: inactiveCount, tone: isDark ? 'text-slate-400' : 'text-slate-500' },
    { label: 'Updates', value: updateCount, tone: 'text-amber-500' },
    { label: 'Errors', value: failedPluginsCount, tone: failedPluginsCount > 0 ? 'text-rose-500' : (isDark ? 'text-slate-400' : 'text-slate-500') },
  ];
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {this.operationStatus && (this.isUploading || this.isActivating) ? <Loader fullPage label={this.operationStatus.message} /> : null}
      {this.loading ? <div className="flex-1 flex items-center justify-center min-h-screen"><Loader label="Synchronizing Global Marketplace Catalog" /></div> : (
        <>
          {failedPluginsCount > 0 ? (
            <div className={`rounded-xl border px-4 py-3 ${theme === ThemeMode.DARK ? 'border-rose-500/20 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${theme === ThemeMode.DARK ? 'bg-rose-500/10 text-rose-400' : 'bg-white text-rose-500 shadow-sm'}`}>
                  <FrameworkIcons.Alert size={18} />
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">Plugin Failures Detected</h3>
                  <p className={`mt-1 text-sm font-medium leading-relaxed ${theme === ThemeMode.DARK ? 'text-rose-100/90' : 'text-rose-700'}`}>
                    {failedPluginsCount} installed {failedPluginsCount === 1 ? 'plugin has' : 'plugins have'} startup or initialization errors. Open the plugin detail page to see the full boot failure.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {this.heldPluginsCount > 0 ? (
            <div className={`rounded-xl border px-4 py-3 ${theme === ThemeMode.DARK ? 'border-amber-500/20 bg-amber-500/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${theme === ThemeMode.DARK ? 'bg-amber-500/10 text-amber-400' : 'bg-white text-amber-500 shadow-sm'}`}>
                  <FrameworkIcons.Alert size={18} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-500">Capability Change Detected</h3>
                  <p className={`mt-1 text-sm font-medium leading-relaxed ${theme === ThemeMode.DARK ? 'text-amber-100/90' : 'text-amber-700'}`}>
                    {this.heldPluginsCount} {this.heldPluginsCount === 1 ? 'plugin is' : 'plugins are'} held pending re-approval after their requested capabilities changed. They stay disabled until an admin re-approves them.
                  </p>
                </div>
                <button onClick={this.onReapproveAll} disabled={this.isActivating} className="shrink-0 flex items-center gap-2 h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold uppercase tracking-wider text-[11px] transition-all active:scale-[0.98] shadow-sm disabled:opacity-50">
                  {this.isActivating ? <FrameworkIcons.Loader className="animate-spin" size={14} /> : <FrameworkIcons.Shield size={14} />}
                  <span>Re-approve all held</span>
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 group">
              <FrameworkIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input type="text" placeholder="Search installed plugins..." value={this.searchQuery} onChange={(event) => this.setSearchQuery(event.target.value)} className={`w-full h-9 ${AdminClass.SURFACE} pl-11 pr-4 outline-none border-0 font-bold transition-all ${theme === ThemeMode.DARK ? 'bg-slate-900/60 text-white placeholder:text-slate-600 focus:ring-2 ring-indigo-500/50 shadow-sm' : 'bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 ring-indigo-500/20 shadow-sm'}`} />
            </div>
            <input type="file" ref={this.fileInputRef} onChange={this.handleFileChange} className="hidden" accept=".zip,.tar.gz,.tgz,application/zip,application/gzip,application/x-gzip" />
            <button onClick={this.handleUploadClick} disabled={this.isUploading || this.isInspectingUpload} className="flex items-center justify-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold uppercase tracking-wider text-[11px] transition-all active:scale-[0.98] shadow-sm disabled:opacity-50">{this.isUploading || this.isInspectingUpload ? <FrameworkIcons.Loader className="animate-spin" size={16} /> : <FrameworkIcons.Plus size={16} strokeWidth={2.5} />}<span>{this.isInspectingUpload ? 'Inspecting...' : 'Upload (.zip/.tar.gz)'}</span></button>
          </div>
          <div onClick={this.handleUploadClick} onDrop={this.handleDrop} onDragOver={this.handleDragOver} onDragLeave={this.handleDragLeave} className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-4 transition-all ${this.isDropActive ? (theme === ThemeMode.DARK ? 'border-indigo-400 bg-indigo-500/10' : 'border-indigo-500 bg-indigo-50') : (theme === ThemeMode.DARK ? 'border-slate-700 bg-slate-900/30 hover:border-slate-500' : 'border-slate-200 bg-white hover:border-slate-300')}`}>
            <div className="flex items-center gap-3"><FrameworkIcons.Upload size={18} className={this.isDropActive ? 'text-indigo-500' : 'text-slate-400'} /><p className={`text-sm font-medium ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-700'}`}>Drag and drop plugin `.zip` or `.tar.gz` here, or click to upload.</p></div>
            {this.uploadProgressLabel ? (
              <div className="mt-4 space-y-2">
                <div className={`h-2 overflow-hidden rounded-full ${theme === ThemeMode.DARK ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-200"
                    style={{ width: `${Math.max(4, Math.min(this.uploadProgressPercent ?? 0, 100))}%` }}
                  />
                </div>
                <p className={`text-xs font-medium ${theme === ThemeMode.DARK ? 'text-slate-300' : 'text-slate-600'}`}>
                  {this.uploadProgressLabel}
                </p>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {summaryStats.map((s) => (
              <div key={s.label} className={`flex items-baseline gap-1.5 rounded-lg border px-3 py-1.5 ${isDark ? 'border-white/10 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'}`}>
                <span className={`text-sm font-bold tabular-nums ${s.tone}`}>{s.value}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</span>
              </div>
            ))}
          </div>
          {filteredPlugins.length === 0 ? (
            <div className="py-12 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800"><div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4"><FrameworkIcons.Plugins size={32} className="text-slate-300 dark:text-slate-700" /></div><h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>No plugins found</h3><p className="text-slate-500 font-medium">Try a different search term or upload a new plugin.</p></div>
          ) : (
            <div className={`${AdminClass.SURFACE} overflow-hidden divide-y ${isDark ? 'border-white/10 divide-white/5 bg-slate-900/30' : 'border-slate-200 divide-slate-100 bg-white shadow-sm'}`}>
              {filteredPlugins.map((plugin) => <InstalledPluginCard key={plugin.manifest.slug} hasImageError={this.imageErrors[plugin.manifest.slug] ?? false} hasUpdate={hasPluginUpdate(plugin)} isDark={isDark} onDelete={this.onDeletePrompt} onImageError={this.markImageError} onToggle={this.handleToggle} plugin={plugin} />)}
            </div>
          )}
        </>
      )}
      <ConfirmDialog isOpen={this.showDeleteConfirm} onClose={this.closeDeleteConfirm} onConfirm={this.onDeleteConfirm} isLoading={this.isDeleting} title="Destroy Plugin" description={this.deleteConfirmDescription} confirmLabel="Destroy Now" />
      <DependencyDialog isOpen={this.showDependencyConfirm} onClose={this.closeDependencyConfirm} onConfirm={this.toggleDependencies} issues={this.dependencyIssues} pluginSlug={this.targetPlugin || ''} isLoading={this.isActivating} />
      <UploadPreviewDialog isOpen={this.showUploadPreview} title={this.uploadPreviewTitle} description={this.uploadPreviewDescription} sections={this.uploadPreviewSections} confirmLabel="Install Plugin" cancelLabel="Cancel" isLoading={this.isUploading} onClose={this.closeUploadPreview} onConfirm={this.confirmUploadPreview} />
    </div>
  );
  }
}
