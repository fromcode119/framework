"use client";

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DependencyDialog } from '@/components/ui/dependency-dialog';
import { FrameworkIcons } from '@/lib/icons';
import { Loader } from '@/components/ui/loader';
import { UploadPreviewDialog } from '@/components/ui/upload-preview-dialog';
import InstalledPluginCard from './installed-plugin-card';
import type { InstalledPluginsViewProps } from '../installed-plugins-page.interfaces';

export default function InstalledPluginsView({
  closeDeleteConfirm,
  closeDependencyConfirm,
  closeUploadPreview,
  confirmUploadPreview,
  deleteConfirmDescription,
  dependencyIssues,
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
  uploadPreviewDescription,
  uploadPreviewSections,
  uploadPreviewTitle,
}: InstalledPluginsViewProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {loading ? <div className="flex-1 flex items-center justify-center min-h-screen"><Loader label="Synchronizing Global Marketplace Catalog" /></div> : (
        <>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="relative flex-1 group">
              <FrameworkIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input type="text" placeholder="Search installed plugins..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className={`w-full rounded-2xl py-2.5 pl-11 pr-6 outline-none border-0 font-bold transition-all ${theme === 'dark' ? 'bg-slate-900/60 text-white placeholder:text-slate-600 focus:ring-2 ring-indigo-500/50 shadow-2xl shadow-indigo-500/5' : 'bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 ring-indigo-500/20 shadow-xl shadow-slate-200/50'}`} />
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip,.tar.gz,.tgz,application/zip,application/gzip,application/x-gzip" />
            <button onClick={handleUploadClick} disabled={isUploading || isInspectingUpload} className="flex items-center justify-center gap-3 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold uppercase tracking-wider text-[11px] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_15px_30px_-5px_rgba(79,70,229,0.3)] disabled:opacity-50">{isUploading || isInspectingUpload ? <FrameworkIcons.Loader className="animate-spin" size={16} /> : <FrameworkIcons.Plus size={16} strokeWidth={2.5} />}<span>{isInspectingUpload ? 'Inspecting...' : 'Upload (.zip/.tar.gz)'}</span></button>
          </div>
          <div onClick={handleUploadClick} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-5 transition-all ${isDropActive ? (theme === 'dark' ? 'border-indigo-400 bg-indigo-500/10' : 'border-indigo-500 bg-indigo-50') : (theme === 'dark' ? 'border-slate-700 bg-slate-900/30 hover:border-slate-500' : 'border-slate-200 bg-white hover:border-slate-300')}`}>
            <div className="flex items-center gap-3"><FrameworkIcons.Upload size={18} className={isDropActive ? 'text-indigo-500' : 'text-slate-400'} /><p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Drag and drop plugin `.zip` or `.tar.gz` here, or click to upload.</p></div>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {filteredPlugins.length === 0 ? <div className="col-span-full py-20 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800"><div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow"><FrameworkIcons.Plugins size={32} className="text-slate-300 dark:text-slate-700" /></div><h3 className={`text-xl font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No plugins found</h3><p className="text-slate-500 font-medium">Try a different search term or upload a new plugin.</p></div> : filteredPlugins.map((plugin) => <InstalledPluginCard key={plugin.manifest.slug} hasImageError={imageErrors[plugin.manifest.slug] ?? false} hasUpdate={hasPluginUpdate(plugin)} isDark={theme === 'dark'} onDelete={onDeletePrompt} onImageError={markImageError} onToggle={handleToggle} plugin={plugin} />)}
          </div>
        </>
      )}
      <ConfirmDialog isOpen={showDeleteConfirm} onClose={closeDeleteConfirm} onConfirm={onDeleteConfirm} isLoading={isDeleting} title="Destroy Plugin" description={deleteConfirmDescription} confirmLabel="Destroy Now" />
      <DependencyDialog isOpen={showDependencyConfirm} onClose={closeDependencyConfirm} onConfirm={toggleDependencies} issues={dependencyIssues} pluginSlug={targetPlugin || ''} isLoading={isActivating} />
      <UploadPreviewDialog isOpen={showUploadPreview} title={uploadPreviewTitle} description={uploadPreviewDescription} sections={uploadPreviewSections} confirmLabel="Install Plugin" cancelLabel="Cancel" isLoading={isUploading} onClose={closeUploadPreview} onConfirm={confirmUploadPreview} />
    </div>
  );
}
