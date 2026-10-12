import type { ReactNode } from 'react';
import { GitBranch, Hammer, Play, RefreshCw } from 'lucide-react';
import { PlatformScopeGate } from '@/components/view/platform-scope-gate.client';
import { Button } from '@/components/ui/view/button.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { ListToolbar } from '@/components/ui/list-toolbar/view/list-toolbar.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { SourcesPageActions } from '@/app/sources/sources-page-actions.client';
import { SourcesTable } from '@/app/sources/components/view/sources-table.client';
import { BuildSourceDialog } from '@/app/sources/components/view/build-source-dialog.client';
import { BuildSourceForm } from '@/app/sources/components/view/build-source-form.client';
import { SourceEditorMode } from '@/app/sources/enums/source-editor-mode.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The Sources screen: the repositories this platform builds from, as one searchable, filterable
 * table. The top of the chain — what it holds and does is in `SourcesPageState` and its actions.
 */
export class BuildOverview extends SourcesPageActions {
  static slots = ['admin.plugin.sources.content', 'admin.plugin.sources.overview', 'admin.plugin.sources.page.sources'];

  private get emptyMessage(): string {
    return this.builds.length ? AdminI18n.t('sources.noSourcesMatch') : AdminI18n.t('sources.useAddSourceToTrack');
  }

  private renderHeaderActions(): ReactNode {
    return (
      <div className="flex items-center gap-2">
        <Button disabled={this.checking} icon={<RefreshCw size={14} className={this.checking ? 'animate-spin' : ''} />} onClick={this.checkUpdates} variant={ButtonVariant.OUTLINE}>
          {this.checking ? AdminI18n.t('sources.checking') : AdminI18n.t('sources.checkUpdates')}
        </Button>
        <Button disabled={this.triggering} icon={<Play size={14} />} onClick={this.buildAll} variant={ButtonVariant.SECONDARY}>
          {this.triggering ? AdminI18n.t('sources.building2') : AdminI18n.t('sources.buildAll')}
        </Button>
        <Button icon={<GitBranch size={14} />} onClick={this.openCreate} variant={ButtonVariant.PRIMARY}>
          {AdminI18n.t('sources.addSource')}
        </Button>
      </div>
    );
  }

  private renderEditor(): ReactNode {
    if (!this.editorMode) return null;
    const editing = this.editorMode === SourceEditorMode.EDIT;
    return (
      <BuildSourceDialog
        title={editing ? AdminI18n.t('sources.edit2', { name: this.editingBuild?.slug || AdminI18n.t('sources.source') }) : AdminI18n.t('sources.addSource')}
        description={editing ? AdminI18n.t('sources.updateRepositoryDetailsHereLeave') : AdminI18n.t('sources.pasteARepositoryUrl')}
        onClose={this.closeEditor}
      >
        <BuildSourceForm build={this.editingBuild} busy={this.savingSource} mode={this.editorMode} onCancel={this.closeEditor} onSubmit={this.saveSource} />
        {this.editorError ? (
          <div role="alert" ref={(el) => el?.scrollIntoView({ block: 'nearest' })} className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {this.editorError}
          </div>
        ) : null}
      </BuildSourceDialog>
    );
  }

  private renderRemoveConfirm(): ReactNode {
    const row = this.removing;
    return (
      <ConfirmDialog
        isOpen={row !== null}
        onClose={this.cancelRemove}
        onConfirm={this.confirmRemove}
        title={AdminI18n.t('sources.removeSourceTitle', { slug: row?.slug ?? '' })}
        description={AdminI18n.t('sources.areYouSureYouWant', { type: row?.type ?? '', slug: row?.slug ?? '' })}
        confirmLabel={AdminI18n.t('sources.remove')}
        variant={ButtonVariant.DANGER}
        isLoading={this.removeBusy}
      />
    );
  }

  render(): ReactNode {
    const matching = this.matchingRows;
    return (
      <PlatformScopeGate what={AdminI18n.t('sources.sources')}>
        {/* No padding on the root: the sticky header spans the content column like every other screen's. */}
        <div className="w-full">
          <CompactPageHeader title={AdminI18n.t('sources.sources')} subtitle={AdminI18n.t('sources.theRepositoriesThisPlatformBuilds')} icon={<Hammer size={20} />} actions={this.renderHeaderActions()} />
          <div className="space-y-4 p-4 lg:p-6">
            {this.error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{this.error}</div>
            ) : null}
            <ListToolbar search={this.search} onSearch={this.setSearch} placeholder={AdminI18n.t('sources.searchSources')} theme={this.theme} filters={this.filters} total={matching.length} />
            <SourcesTable
              rows={this.pageRows}
              loading={this.loading}
              emptyMessage={this.loading ? AdminI18n.t('sources.loadingBuildStatus') : this.emptyMessage}
              openId={this.openId}
              page={this.currentPage}
              limit={BuildOverview.PAGE_SIZE}
              totalDocs={matching.length}
              buildingId={this.buildingId}
              onPageChange={this.setPage}
              onToggle={this.toggleRow}
              onBuild={this.buildOne}
              onEdit={this.openEdit}
              onRemove={this.requestRemove}
            />
          </div>
        </div>
        {this.renderEditor()}
        {this.renderRemoveConfirm()}
      </PlatformScopeGate>
    );
  }
}
