import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactElement } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { Loader } from '@/components/ui/view/loader.client';
import { Card } from '@/components/ui/view/card.client';
import { BackupCreateCard } from '@/components/settings/backups/view/backup-create-card.client';
import { BackupListCard } from '@/components/settings/backups/view/backup-list-card.client';
import { BackupOperatorNotesCard } from '@/components/settings/backups/view/backup-operator-notes-card.client';
import { BackupRestoreDialog } from '@/components/settings/backups/view/backup-restore-dialog.client';
import { BackupSummaryCard } from '@/components/settings/backups/view/backup-summary-card.client';
import type { IThemeContextType } from '@/components/interfaces/theme-context-type.interface';
import type { IBackupsPageControllerState } from '@/components/settings/backups/interfaces/backups-page-controller-state.interface';

/**
 * Hook-free presentational class body of {@link BackupsPageClient}. The thin functional shim reads
 * `ThemeHooks.useTheme()` + `BackupsPageControllerHooks.useController()` and passes the resolved
 * `theme` + controller object in as props.
 */
export class BackupsPageClientView extends PureReactor {
  @prop declare theme: IThemeContextType['theme'];
  @prop declare controller: IBackupsPageControllerState;

  render(): ReactElement {
    const { theme, controller } = this;

    if (controller.backupState.isLoading) {
      return <div className="p-12"><Loader label="Indexing Backup Inventory..." /></div>;
    }

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <div className={`sticky top-0 z-30 border-b px-8 py-6 backdrop-blur-md ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-white/50'}`}>
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>Backups</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 opacity-60">System snapshots, restore previews, and site transfer guidance</p>
          </div>
        </div>

        <div className="space-y-8 p-8 pb-24 lg:p-12">
          {controller.backupState.errorMessage ? (
            <Card className="border border-rose-200 bg-rose-50/80 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold tracking-tight">Backup inventory failed to load</h2>
                  <p className="mt-2 text-sm">{controller.backupState.errorMessage}</p>
                </div>
              </div>
            </Card>
          ) : null}

          <BackupSummaryCard groups={controller.backupState.groups} capabilities={controller.backupState.capabilities} />

          <BackupCreateCard
            capabilities={controller.backupState.capabilities}
            createSections={controller.createSections}
            isCreating={controller.backupState.isCreating}
            isImporting={controller.backupState.isImporting}
            createProgress={controller.backupState.createProgress}
            importProgress={controller.backupState.importProgress}
            onToggleSection={controller.toggleCreateSection}
            onApplyPreset={controller.applyCreatePreset}
            onCreate={controller.handleCreate}
            onImport={controller.handleImport}
          />

          <BackupListCard
            groups={controller.backupState.groups}
            capabilities={controller.backupState.capabilities}
            isRefreshing={controller.backupState.isRefreshing}
            downloadProgress={controller.backupState.downloadProgress}
            activeDeleteId={controller.backupState.activeDeleteId}
            activePreviewId={controller.backupState.activePreviewId}
            onRefresh={controller.handleRefresh}
            onDownload={controller.handleDownload}
            onRequestDelete={controller.handleRequestDelete}
            onRequestRestore={controller.handleRequestRestore}
          />

          <BackupOperatorNotesCard />
        </div>

        <ConfirmDialog
          isOpen={Boolean(controller.deleteCandidate)}
          onClose={controller.closeDeleteDialog}
          onConfirm={controller.handleDelete}
          isLoading={Boolean(controller.deleteCandidate) && controller.backupState.activeDeleteId === controller.deleteCandidate?.id}
          title="Delete Backup Archive?"
          description={controller.deleteCandidate ? `Delete ${controller.deleteCandidate.displayName}. This removes the managed archive from backups and cannot be undone from admin.` : ''}
          confirmLabel="Delete Backup"
          variant={ButtonVariant.DANGER}
        />

        <BackupRestoreDialog
          isOpen={Boolean(controller.restoreState.backup)}
          state={controller.restoreState}
          isPreviewing={Boolean(controller.restoreState.backup) && controller.backupState.activePreviewId === controller.restoreState.backup?.id}
          isRestoring={Boolean(controller.restoreState.backup) && controller.backupState.activeRestoreId === controller.restoreState.backup?.id}
          onClose={controller.closeRestoreDialog}
          onTargetScopeChange={controller.updateRestoreTargetScope}
          onTargetSlugChange={controller.updateRestoreTargetSlug}
          onConfirmationTextChange={controller.updateRestoreConfirmationText}
          onPreview={controller.handlePreviewRestore}
          onExecute={controller.handleExecuteRestore}
        />
      </div>
    );
  }
}
