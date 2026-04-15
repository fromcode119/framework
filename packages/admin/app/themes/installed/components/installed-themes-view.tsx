"use client";

import { FrameworkIcons } from '@/lib/icons';
import { UploadPreviewDialog } from '@/components/ui/upload-preview-dialog';
import InstalledThemeCard from './installed-theme-card';
import type { InstalledThemesViewProps } from '../installed-themes-page.interfaces';

export default function InstalledThemesView({
  closeUploadPreview,
  confirmUploadPreview,
  fileInputRef,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleFileChange,
  handleUploadClick,
  isDropActive,
  isInspectingUpload,
  isUploading,
  loading,
  onActivate,
  onDisable,
  onDelete,
  onUpdate,
  showUploadPreview,
  themes,
  themeMode,
  uploadPreviewDescription,
  uploadPreviewSections,
  uploadPreviewTitle,
  updateVersionForTheme,
}: InstalledThemesViewProps) {
  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 min-[1400px]:grid-cols-3 gap-6">{[1, 2, 3].map((value) => <div key={value} className={`h-64 rounded-3xl animate-pulse ${themeMode === 'dark' ? 'bg-slate-900/40' : 'bg-white border-2 border-slate-50 shadow-xl shadow-slate-200/50'}`} />)}</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div onClick={handleUploadClick} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-5 transition-all ${isDropActive ? (themeMode === 'dark' ? 'border-indigo-400 bg-indigo-500/10' : 'border-indigo-500 bg-indigo-50') : (themeMode === 'dark' ? 'border-slate-700 bg-slate-900/30 hover:border-slate-500' : 'border-slate-200 bg-white hover:border-slate-300')}`}>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip,.tar.gz,.tgz,application/zip,application/gzip,application/x-gzip" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><FrameworkIcons.Upload size={18} className={isDropActive ? 'text-indigo-500' : 'text-slate-400'} /><p className={`text-sm font-medium ${themeMode === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Drag and drop theme `.zip` or `.tar.gz` here, or click to upload.</p></div>
          <button type="button" onClick={(event) => { event.stopPropagation(); handleUploadClick(); }} disabled={isUploading || isInspectingUpload} className="flex items-center justify-center gap-3 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold uppercase tracking-wider text-[11px] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_15px_30px_-5px_rgba(79,70,229,0.3)] disabled:opacity-50">{isUploading || isInspectingUpload ? <FrameworkIcons.Loader className="animate-spin" size={16} /> : <FrameworkIcons.Plus size={16} strokeWidth={2.5} />}<span>{isInspectingUpload ? 'Inspecting...' : 'Upload Theme (.zip/.tar.gz)'}</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 min-[1400px]:grid-cols-3 gap-6">
        {themes.length === 0 ? <div className="col-span-full py-20 text-center rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20"><div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4"><FrameworkIcons.Palette size={32} className="text-slate-300 dark:text-slate-700" /></div><h3 className={`text-xl font-semibold mb-1 ${themeMode === 'dark' ? 'text-white' : 'text-slate-900'}`}>No themes installed</h3><p className="text-slate-500 font-medium italic">Your creative workspace is currently empty.</p></div> : themes.map((theme) => <InstalledThemeCard key={theme.slug} isDark={themeMode === 'dark'} onActivate={onActivate} onDisable={onDisable} onDelete={onDelete} onUpdate={onUpdate} theme={theme} updateVersion={updateVersionForTheme(theme)} />)}
      </div>

      <UploadPreviewDialog isOpen={showUploadPreview} title={uploadPreviewTitle} description={uploadPreviewDescription} sections={uploadPreviewSections} confirmLabel="Install Theme" cancelLabel="Cancel" isLoading={isUploading} onClose={closeUploadPreview} onConfirm={confirmUploadPreview} />
    </div>
  );
}
