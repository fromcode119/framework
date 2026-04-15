'use client';

import React from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@/lib/icons';
import type { BackupCreateCardProps } from './backups-page-client.interfaces';
import { SystemBackupPageUtils } from './system-backup-page-utils';

const BACKUP_IMPORT_ACCEPT = '.tar.gz,.gz,application/gzip,application/x-gzip,.sql,.db';

export function BackupCreateCard({
  capabilities,
  createSections,
  isCreating,
  isImporting,
  createProgress,
  importProgress,
  onToggleSection,
  onApplyPreset,
  onCreate,
  onImport,
}: BackupCreateCardProps) {
  const { theme } = ThemeHooks.useTheme();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDropActive, setIsDropActive] = React.useState(false);
  const [importError, setImportError] = React.useState('');

  const handleImportFile = React.useCallback((file: File | null) => {
    if (!file) {
      return;
    }

    const normalizedName = String(file.name || '').trim().toLowerCase();
    const isSupportedArchive = normalizedName.endsWith('.tar.gz') || normalizedName.endsWith('.sql') || normalizedName.endsWith('.db');
    if (!isSupportedArchive) {
      setImportError('Choose a .tar.gz, .sql, or .db backup archive.');
      return;
    }

    setImportError('');
    void onImport(file);
  }, [onImport]);

  const handleUploadClick = React.useCallback(() => {
    if (!capabilities.canManage || isCreating || isImporting) {
      return;
    }

    fileInputRef.current?.click();
  }, [capabilities.canManage, isCreating, isImporting]);

  const handleFileChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    handleImportFile(file || null);
  }, [handleImportFile]);

  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!capabilities.canManage || isCreating || isImporting) {
      return;
    }

    setIsDropActive(true);
  }, [capabilities.canManage, isCreating, isImporting]);

  const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDropActive(false);
    }
  }, []);

  const handleDrop = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDropActive(false);
    if (!capabilities.canManage || isCreating || isImporting) {
      return;
    }

    handleImportFile(event.dataTransfer.files?.[0] || null);
  }, [capabilities.canManage, handleImportFile, isCreating, isImporting]);

  return (
    <Card className="border-0 rounded-[2rem] p-0 overflow-hidden shadow-[0_24px_64px_-24px_rgba(15,23,42,0.18)] dark:ring-1 dark:ring-white/5">
      <div className={`border-b px-8 py-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-white/80'}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className={`text-lg font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Create Backup</h2>
            <p className="text-sm text-slate-500">
              Pick exactly what goes into the archive before you create it. Full backup means core files, database, plugins, and themes together.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={BACKUP_IMPORT_ACCEPT}
              onChange={handleFileChange}
            />
            <Button
              variant="secondary"
              className="rounded-xl px-5 uppercase tracking-[0.16em]"
              icon={<FrameworkIcons.Upload size={14} />}
              isLoading={isImporting}
              onClick={handleUploadClick}
              disabled={!capabilities.canManage || isCreating || isImporting}
            >
              {isImporting ? 'Importing Backup...' : 'Import Backup'}
            </Button>
            <Button
              className="rounded-xl px-5 uppercase tracking-[0.16em]"
              icon={<FrameworkIcons.Plus size={14} />}
              onClick={() => void onCreate()}
              disabled={!capabilities.canManage || !createSections.length || isCreating || isImporting}
            >
              {isCreating ? 'Creating Backup...' : 'Create Backup'}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-8 py-8">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" className="rounded-xl uppercase tracking-[0.16em]" onClick={() => onApplyPreset('full')}>
            Full Backup
          </Button>
          <Button variant="secondary" size="sm" className="rounded-xl uppercase tracking-[0.16em]" onClick={() => onApplyPreset('core-db')}>
            Core + DB
          </Button>
          <Button variant="secondary" size="sm" className="rounded-xl uppercase tracking-[0.16em]" onClick={() => onApplyPreset('plugins-only')}>
            Plugins Only
          </Button>
          <Button variant="secondary" size="sm" className="rounded-xl uppercase tracking-[0.16em]" onClick={() => onApplyPreset('themes-only')}>
            Themes Only
          </Button>
        </div>

        <div
          onClick={handleUploadClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`cursor-pointer rounded-[1.5rem] border-2 border-dashed px-6 py-5 transition-all ${!capabilities.canManage || isCreating || isImporting
            ? theme === 'dark'
              ? 'cursor-not-allowed border-slate-800 bg-slate-950/20 opacity-70'
              : 'cursor-not-allowed border-slate-200 bg-slate-50/50 opacity-70'
            : isDropActive
              ? theme === 'dark'
                ? 'border-indigo-400 bg-indigo-500/10'
                : 'border-indigo-500 bg-indigo-50'
              : theme === 'dark'
                ? 'border-slate-700 bg-slate-900/30 hover:border-slate-500'
                : 'border-slate-200 bg-white hover:border-slate-300'}`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <FrameworkIcons.Upload size={18} className={isDropActive ? 'text-indigo-500' : 'text-slate-400'} />
              <div>
                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                  Drag and drop a backup `.tar.gz`, `.sql`, or `.db` here, or click to browse.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Imported archives are indexed into managed backups and can then be restored from the existing workflow.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleUploadClick();
              }}
              disabled={!capabilities.canManage || isCreating || isImporting}
              className="flex items-center justify-center gap-3 rounded-xl bg-indigo-600 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white transition-all shadow-[0_15px_30px_-5px_rgba(79,70,229,0.3)] hover:scale-[1.02] hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
            >
              {isImporting ? <FrameworkIcons.Loader className="animate-spin" size={16} /> : <FrameworkIcons.Upload size={16} />}
              <span>{isImporting ? 'Importing...' : 'Choose Backup'}</span>
            </button>
          </div>
        </div>

        {importError ? (
          <div className={`rounded-[1.25rem] border px-4 py-3 text-sm ${theme === 'dark' ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50/80 text-rose-700'}`}>
            {importError}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {SystemBackupPageUtils.getSectionOptions().map((option) => {
            const isSelected = createSections.includes(option.key);
            const icon = option.key === 'database'
              ? <FrameworkIcons.Database size={18} />
              : option.key === 'plugins'
                ? <FrameworkIcons.Package size={18} />
                : option.key === 'themes'
                  ? <FrameworkIcons.Layers size={18} />
                  : <FrameworkIcons.Shield size={18} />;

            return (
              <button
                key={option.key}
                type="button"
                disabled={isCreating}
                onClick={() => onToggleSection(option.key)}
                className={`rounded-[1.5rem] border p-5 text-left transition-all ${isSelected
                  ? theme === 'dark'
                    ? 'border-indigo-500/40 bg-indigo-500/10 shadow-[0_16px_40px_-24px_rgba(99,102,241,0.55)]'
                    : 'border-indigo-200 bg-indigo-50/80 shadow-[0_16px_40px_-24px_rgba(79,70,229,0.35)]'
                  : theme === 'dark'
                    ? 'border-slate-800 bg-slate-950/30 hover:border-slate-700'
                    : 'border-slate-100 bg-slate-50/60 hover:border-slate-200 hover:bg-white'}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isSelected ? 'bg-indigo-600 text-white' : theme === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    {icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className={`text-sm font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{option.label}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${isSelected ? 'bg-indigo-600 text-white' : theme === 'dark' ? 'bg-slate-900 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                        {isSelected ? 'Included' : 'Optional'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{option.description}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{option.helper}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className={`rounded-[1.5rem] border px-5 py-4 ${theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/60'}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Selected Scope</p>
              <p className={`mt-2 text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {SystemBackupPageUtils.describeSections(createSections)}
              </p>
            </div>
            <p className="max-w-xl text-sm text-slate-500">
              System backup is the archive you can download and later use for restore or transfer. The selection above decides whether it contains core files, database state, plugins, themes, or any combination of them.
            </p>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Import accepts exported .tar.gz archives and database-only .sql or .db backups, then indexes them into managed backups for download or restore.
          </p>

          {importProgress ? (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
                <span>{importProgress.label}</span>
                <span>{importProgress.percent}%</span>
              </div>
              <div className={`h-2 overflow-hidden rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                  style={{ width: `${importProgress.percent}%` }}
                />
              </div>
            </div>
          ) : null}

          {createProgress ? (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
                <span>{createProgress.label}</span>
                <span>{createProgress.percent}%</span>
              </div>
              <div className={`h-2 overflow-hidden rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div
                  className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
                  style={{ width: `${createProgress.percent}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}