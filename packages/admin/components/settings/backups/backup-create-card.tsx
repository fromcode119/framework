'use client';

import React from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@/lib/icons';
import type { BackupCreateCardProps } from './backups-page-client.interfaces';
import { SystemBackupPageUtils } from './system-backup-page-utils';

export function BackupCreateCard({
  capabilities,
  createSections,
  isCreating,
  isImporting,
  createProgress,
  onToggleSection,
  onApplyPreset,
  onCreate,
  onImport,
}: BackupCreateCardProps) {
  const { theme } = ThemeHooks.useTheme();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    void onImport(file);
  }, [onImport]);

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
              accept=".tar.gz,.sql,.db"
              onChange={handleFileChange}
            />
            <Button
              variant="secondary"
              className="rounded-xl px-5 uppercase tracking-[0.16em]"
              icon={<FrameworkIcons.Upload size={14} />}
              isLoading={isImporting}
              onClick={() => fileInputRef.current?.click()}
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