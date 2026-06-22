"use client";

import React from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DependencyDialog } from '@/components/ui/dependency-dialog';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/loader';
import { UploadPreviewDialog } from '@/components/ui/upload-preview-dialog';
import InstalledPluginCard from './installed-plugin-card';
import type { InstalledPluginsViewProps } from '../installed-plugins-page.interfaces';

export default class InstalledPluginsView extends React.Component<InstalledPluginsViewProps> {
  render(): React.ReactNode {
    const {
  closeDeleteConfirm,
  closeDependencyConfirm,
  closeUploadPreview,
  confirmUploadPreview,
  deleteConfirmDescription,
  dependencyIssues,
  failedPluginsCount,
  filteredPlugins,
  fileInputRef,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleFileChange,
  hasPluginUpdate,
  handleToggle,
  handleUploadClick,
  imageErrors,
  isActivating,
  isDeleting,
  isDropActive,
  isInspectingUpload,
  isUploading,
  loading,
  operationStatus,
  markImageError,
  onDeleteConfirm,
  onDeletePrompt,
  searchQuery,
  setSearchQuery,
  showDeleteConfirm,
  showDependencyConfirm,
  showUploadPreview,
  targetPlugin,
  theme,
  toggleDependencies,
  uploadProgressLabel,
  uploadProgressPercent,
  uploadPreviewDescription,
  uploadPreviewSections,
  uploadPreviewTitle,
} = this.props;
  const isDark = theme === 'dark';
  const activeCount = filteredPlugins.filter((p) => p.state === 'active' && !p.error).length;
  const inactiveCount = filteredPlugins.filter((p) => p.state !== 'active' && !(Boolean(p.error) || p.state === 'error')).length;
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
      {operationStatus && (isUploading || isActivating) ? <Loader fullPage label={operationStatus.message} /> : null}
      {loading ? <div className="flex-1 flex items-center justify-center min-h-screen"><Loader label="Synchronizing Global Marketplace Catalog" /></div> : (
        <>
          {failedPluginsCount > 0 ? (
            <div className={`rounded-xl border px-4 py-3 ${theme === 'dark' ? 'border-rose-500/20 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${theme === 'dark' ? 'bg-rose-500/10 text-rose-400' : 'bg-white text-rose-500 shadow-sm'}`}>
                  <FrameworkIcons.Alert size={18} />
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">Plugin Failures Detected</h3>
                  <p className={`mt-1 text-sm font-medium leading-relaxed ${theme === 'dark' ? 'text-rose-100/90' : 'text-rose-700'}`}>
                    {failedPluginsCount} installed {failedPluginsCount === 1 ? 'plugin has' : 'plugins have'} startup or initialization errors. Open the plugin detail page to see the full boot failure.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 group">
              <FrameworkIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input type="text" placeholder="Search installed plugins..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className={`w-full h-9 rounded-xl pl-11 pr-4 outline-none border-0 font-bold transition-all ${theme === 'dark' ? 'bg-slate-900/60 text-white placeholder:text-slate-600 focus:ring-2 ring-indigo-500/50 shadow-sm' : 'bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 ring-indigo-500/20 shadow-sm'}`} />
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip,.tar.gz,.tgz,application/zip,application/gzip,application/x-gzip" />
            <button onClick={handleUploadClick} disabled={isUploading || isInspectingUpload} className="flex items-center justify-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold uppercase tracking-wider text-[11px] transition-all active:scale-[0.98] shadow-sm disabled:opacity-50">{isUploading || isInspectingUpload ? <FrameworkIcons.Loader className="animate-spin" size={16} /> : <FrameworkIcons.Plus size={16} strokeWidth={2.5} />}<span>{isInspectingUpload ? 'Inspecting...' : 'Upload (.zip/.tar.gz)'}</span></button>
          </div>
          <div onClick={handleUploadClick} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-4 transition-all ${isDropActive ? (theme === 'dark' ? 'border-indigo-400 bg-indigo-500/10' : 'border-indigo-500 bg-indigo-50') : (theme === 'dark' ? 'border-slate-700 bg-slate-900/30 hover:border-slate-500' : 'border-slate-200 bg-white hover:border-slate-300')}`}>
            <div className="flex items-center gap-3"><FrameworkIcons.Upload size={18} className={isDropActive ? 'text-indigo-500' : 'text-slate-400'} /><p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Drag and drop plugin `.zip` or `.tar.gz` here, or click to upload.</p></div>
            {uploadProgressLabel ? (
              <div className="mt-4 space-y-2">
                <div className={`h-2 overflow-hidden rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-200"
                    style={{ width: `${Math.max(4, Math.min(uploadProgressPercent ?? 0, 100))}%` }}
                  />
                </div>
                <p className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {uploadProgressLabel}
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
            <div className={`rounded-xl border overflow-hidden divide-y ${isDark ? 'border-white/10 divide-white/5 bg-slate-900/30' : 'border-slate-200 divide-slate-100 bg-white shadow-sm'}`}>
              {filteredPlugins.map((plugin) => <InstalledPluginCard key={plugin.manifest.slug} hasImageError={imageErrors[plugin.manifest.slug] ?? false} hasUpdate={hasPluginUpdate(plugin)} isDark={isDark} onDelete={onDeletePrompt} onImageError={markImageError} onToggle={handleToggle} plugin={plugin} />)}
            </div>
          )}
        </>
      )}
      <ConfirmDialog isOpen={showDeleteConfirm} onClose={closeDeleteConfirm} onConfirm={onDeleteConfirm} isLoading={isDeleting} title="Destroy Plugin" description={deleteConfirmDescription} confirmLabel="Destroy Now" />
      <DependencyDialog isOpen={showDependencyConfirm} onClose={closeDependencyConfirm} onConfirm={toggleDependencies} issues={dependencyIssues} pluginSlug={targetPlugin || ''} isLoading={isActivating} />
      <UploadPreviewDialog isOpen={showUploadPreview} title={uploadPreviewTitle} description={uploadPreviewDescription} sections={uploadPreviewSections} confirmLabel="Install Plugin" cancelLabel="Cancel" isLoading={isUploading} onClose={closeUploadPreview} onConfirm={confirmUploadPreview} />
    </div>
  );
  }
}
