import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { PureReactor, prop, Ref } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { UploadPreviewDialog } from '@/components/ui/view/upload-preview-dialog.client';
import { InstalledThemeCard } from '@/app/themes/installed/components/view/installed-theme-card.client';
import type { IInstalledThemeManifest } from '@/app/themes/installed/interfaces/installed-theme-manifest.interface';
import { IUploadPreviewSection } from '@/components/ui/interfaces/upload-preview-section.interface';
import { ThemeState } from '@fromcode119/core/client';
import { AdminClass } from '@/lib/admin-class';

export class InstalledThemesView extends PureReactor {
  @prop declare closeUploadPreview: () => void;
  @prop declare confirmUploadPreview: () => Promise<void>;
  @prop declare fileInputRef: Ref<HTMLInputElement>;
  @prop declare handleDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  @prop declare handleDragOver: (event: DragEvent<HTMLDivElement>) => void;
  @prop declare handleDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>;
  @prop declare handleFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  @prop declare handleUploadClick: () => void;
  @prop declare isDropActive: boolean;
  @prop declare isInspectingUpload: boolean;
  @prop declare isUploading: boolean;
  @prop declare loading: boolean;
  @prop declare onActivate: (slug: string) => Promise<void>;
  @prop declare onDisable: (slug: string) => Promise<void>;
  @prop declare onDelete: (slug: string, isActive: boolean) => Promise<void>;
  @prop declare onUpdate: (slug: string) => Promise<void>;
  @prop declare showUploadPreview: boolean;
  @prop declare themes: IInstalledThemeManifest[];
  @prop declare themeMode: ThemeMode;
  @prop declare uploadProgressLabel: string | null;
  @prop declare uploadProgressPercent: number | null;
  @prop declare uploadPreviewDescription: string;
  @prop declare uploadPreviewSections: IUploadPreviewSection[];
  @prop declare uploadPreviewTitle: string;
  @prop declare updateVersionForTheme: (theme: IInstalledThemeManifest) => string | null;

  render(): ReactNode {
    const {
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
  uploadProgressLabel,
  uploadProgressPercent,
  uploadPreviewDescription,
  uploadPreviewSections,
  uploadPreviewTitle,
  updateVersionForTheme,
} = this;
  const isDark = themeMode === ThemeMode.DARK;
  // `themes` is API JSON, so `state` is a raw string here — resolve before comparing to a member.
  const activeCount = themes.filter((t) => ThemeState.resolve(t.state) === ThemeState.ACTIVE).length;
  const updateCount = themes.filter((t) => updateVersionForTheme(t)).length;
  const summaryStats: Array<{ label: string; value: number; tone: string }> = [
    { label: 'Total', value: themes.length, tone: isDark ? 'text-white' : 'text-slate-900' },
    { label: 'Active', value: activeCount, tone: 'text-indigo-500' },
    { label: 'Updates', value: updateCount, tone: 'text-amber-500' },
  ];
  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 min-[1400px]:grid-cols-3 gap-4">{[1, 2, 3].map((value) => <div key={value} className={`h-48 ${AdminClass.SURFACE} animate-pulse ${themeMode === ThemeMode.DARK ? 'bg-slate-900/40' : 'bg-white border border-slate-100 shadow-sm'}`} />)}</div>;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div onClick={handleUploadClick} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-4 transition-all ${isDropActive ? (themeMode === ThemeMode.DARK ? 'border-indigo-400 bg-indigo-500/10' : 'border-indigo-500 bg-indigo-50') : (themeMode === ThemeMode.DARK ? 'border-slate-700 bg-slate-900/30 hover:border-slate-500' : 'border-slate-200 bg-white hover:border-slate-300')}`}>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip,.tar.gz,.tgz,application/zip,application/gzip,application/x-gzip" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><FrameworkIcons.Upload size={18} className={isDropActive ? 'text-indigo-500' : 'text-slate-400'} /><p className={`text-sm font-medium ${themeMode === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-700'}`}>Drag and drop theme `.zip` or `.tar.gz` here, or click to upload.</p></div>
          <button type="button" onClick={(event) => { event.stopPropagation(); handleUploadClick(); }} disabled={isUploading || isInspectingUpload} className="flex items-center justify-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold uppercase tracking-wider text-[11px] transition-all active:scale-[0.98] shadow-sm disabled:opacity-50">{isUploading || isInspectingUpload ? <FrameworkIcons.Loader className="animate-spin" size={16} /> : <FrameworkIcons.Plus size={16} strokeWidth={2.5} />}<span>{isInspectingUpload ? 'Inspecting...' : 'Upload Theme (.zip/.tar.gz)'}</span></button>
        </div>
        {uploadProgressLabel ? (
          <div className="mt-4 space-y-2">
            <div className={`h-2 overflow-hidden rounded-full ${themeMode === ThemeMode.DARK ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-200"
                style={{ width: `${Math.max(4, Math.min(uploadProgressPercent ?? 0, 100))}%` }}
              />
            </div>
            <p className={`text-xs font-medium ${themeMode === ThemeMode.DARK ? 'text-slate-300' : 'text-slate-600'}`}>
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

      {themes.length === 0 ? (
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20"><div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-3"><FrameworkIcons.Palette size={24} className="text-slate-300 dark:text-slate-700" /></div><h3 className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>No themes installed</h3><p className="text-slate-500 font-medium text-sm">Your creative workspace is currently empty.</p></div>
      ) : (
        <div className={`${AdminClass.SURFACE} overflow-hidden divide-y ${isDark ? 'border-white/10 divide-white/5 bg-slate-900/30' : 'border-slate-200 divide-slate-100 bg-white shadow-sm'}`}>
          {themes.map((theme) => <InstalledThemeCard key={theme.slug} isDark={isDark} onActivate={onActivate} onDisable={onDisable} onDelete={onDelete} onUpdate={onUpdate} theme={theme} updateVersion={updateVersionForTheme(theme)} />)}
        </div>
      )}

      <UploadPreviewDialog isOpen={showUploadPreview} title={uploadPreviewTitle} description={uploadPreviewDescription} sections={uploadPreviewSections} confirmLabel="Install Theme" cancelLabel="Cancel" isLoading={isUploading} onClose={closeUploadPreview} onConfirm={confirmUploadPreview} />
    </div>
  );
  }
}
