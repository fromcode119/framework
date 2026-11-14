import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { Reactor, prop, state, bound, Ref } from '@fromcode119/react-class-components';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { DependencyDialog } from '@/components/ui/view/dependency-dialog.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { Loader } from '@/components/ui/view/loader.client';
import { UploadPreviewDialog } from '@/components/ui/view/upload-preview-dialog.client';
import { InstalledPluginCard } from '@/app/plugins/installed/components/view/installed-plugin-card.client';
import { IDependencyIssue } from '@/components/ui/interfaces/dependency-issue.interface';
import { IUploadPreviewSection } from '@/components/ui/interfaces/upload-preview-section.interface';
import { IPluginInstallOperation } from '@/lib/interfaces/plugin-install-operation.interface';
import { AdminClass } from '@/lib/admin-class';
import { PlatformScopeGate } from '@/components/view/platform-scope-gate.client';
import { SitePluginOffers } from '@/app/plugins/installed/components/view/site-plugin-offers.client';
import { SiteOwnPlugins } from '@/app/plugins/installed/components/view/site-own-plugins.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Input } from '@/components/ui/view/input.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { PluginListFilter } from '@/app/plugins/installed/enums/plugin-list-filter.enum';

export class InstalledPluginsView extends Reactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<InstalledPluginsView, 'canManage' | 'siteScope' | 'closeDeleteConfirm' | 'closeDependencyConfirm' | 'closeUploadPreview' | 'confirmUploadPreview' | 'deleteConfirmDescription' | 'dependencyIssues' | 'failedPluginsCount' | 'heldPluginsCount' | 'onReapproveAll' | 'filteredPlugins' | 'fileInputRef' | 'handleDragLeave' | 'handleDragOver' | 'handleDrop' | 'handleFileChange' | 'hasPluginUpdate' | 'handleToggle' | 'handleUploadClick' | 'imageErrors' | 'isActivating' | 'isDeleting' | 'isDropActive' | 'isInspectingUpload' | 'isUploading' | 'loading' | 'operationStatus' | 'markImageError' | 'onNavigate' | 'onDeleteConfirm' | 'onDeletePrompt' | 'searchQuery' | 'setSearchQuery' | 'showDeleteConfirm' | 'showDependencyConfirm' | 'showUploadPreview' | 'targetPlugin' | 'theme' | 'toggleDependencies' | 'uploadProgressLabel' | 'uploadProgressPercent' | 'uploadPreviewDescription' | 'uploadPreviewSections' | 'uploadPreviewTitle'>;

  @prop declare closeDeleteConfirm: () => void;
  @prop declare closeDependencyConfirm: () => void;
  /** False for a tenant admin on a multi-tenant deployment: no upload, no switches, no delete. */
  @prop declare canManage: boolean;
  /** In a site: this is the site's list; managing plugins themselves is the platform's (`PlatformScopeGate`). */
  @prop declare siteScope: boolean;
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
  @prop declare onNavigate: (href: string) => void;
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

  /** Which tab of the list is open. */
  @state private filter: PluginListFilter = PluginListFilter.ALL;

  private count(filter: PluginListFilter): number {
    return this.filteredPlugins.filter((plugin) => filter.matches(plugin, this.hasPluginUpdate(plugin))).length;
  }

  /** A file dragged from outside, not a row or a text selection dragged inside the page. */
  @bound
  private onPageDragOver(event: DragEvent<HTMLDivElement>): void {
    if (!this.canManage || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    this.handleDragOver(event);
  }

  /** Every tab with its count, a zero included: the row says at a glance that nothing failed or waits for an update. */
  private renderTabs(): ReactNode {
    return (
      <div className={AdminClass.of('ext-tabbar')}>
      <nav className={AdminClass.of('ext-tabs')} aria-label={AdminI18n.t('plugins.list.searchInstalledPlugins')}>
        {PluginListFilter.ORDER.map((filter) => {
          const count = this.count(filter);
          return (
            <button key={filter.value} type="button" className={AdminClass.of('ext-tabs__tab')}
              aria-current={filter === this.filter ? 'page' : undefined} onClick={() => { this.filter = filter; }}>
              {AdminI18n.t(filter.labelKey)}<span className={AdminClass.of('ext-tabs__count')}>{count}</span>
            </button>
          );
        })}
      </nav>
      {this.renderToolbar()}
      </div>
    );
  }

  private renderAlerts(): ReactNode {
    const failed = this.failedPluginsCount;
    const held = this.heldPluginsCount;
    return (
      <>
        {failed > 0 ? (
          <div className={`${AdminClass.of('ext-alert')} ${AdminClass.of('ext-alert--danger')}`} role="alert">
            <FrameworkIcons.Alert size={16} />
            <span className={AdminClass.of('ext-alert__text')}>
              {AdminI18n.t(failed === 1 ? 'plugins.list.failedOne' : 'plugins.list.failedMany', { count: failed })}
            </span>
          </div>
        ) : null}
        {held > 0 ? (
          <div className={`${AdminClass.of('ext-alert')} ${AdminClass.of('ext-alert--warn')}`} role="alert">
            <FrameworkIcons.Alert size={16} />
            <span className={AdminClass.of('ext-alert__text')}>
              {AdminI18n.t(held === 1 ? 'plugins.list.heldOne' : 'plugins.list.heldMany', { count: held })}
            </span>
            {/* Approval changes what the plugin may do on every site, so the server only takes it in
                Platform scope; inside a site the dialog could only end in a refusal. */}
            {this.siteScope
              ? <PlatformScopeGate what={AdminI18n.t('plugins.list.approvingHeldPlugins')}>{null}</PlatformScopeGate>
              : <Button variant={ButtonVariant.OUTLINE} onClick={this.onReapproveAll} isLoading={this.isActivating}>{AdminI18n.t('plugins.list.reApproveAllHeld')}</Button>}
          </div>
        ) : null}
      </>
    );
  }

  private renderToolbar(): ReactNode {
    const busy = this.isUploading || this.isInspectingUpload;
    return (
      <div className={AdminClass.of('ext-toolbar')}>
        <div className={AdminClass.of('ext-toolbar__search')}>
          <FrameworkIcons.Search size={16} />
          <Input type="text" placeholder={AdminI18n.t('plugins.list.searchInstalledPlugins')} value={this.searchQuery} onChange={(event) => this.setSearchQuery(event.target.value)} inputClassName="ps-10" />
        </div>
        {/* Hidden entirely for a tenant admin: uploading puts code on the box every site runs on,
            and an upload that can only ever 403 is a bug, not a hint. */}
        {this.canManage ? <input type="file" ref={this.fileInputRef} onChange={this.handleFileChange} className="hidden" accept=".zip,.tar.gz,.tgz,application/zip,application/gzip,application/x-gzip" /> : null}
        {this.canManage ? (
          <Button onClick={this.handleUploadClick} isLoading={busy}>
            {this.isInspectingUpload ? AdminI18n.t('plugins.list.inspecting') : AdminI18n.t('plugins.list.uploadZipTarGz')}
          </Button>
        ) : null}
      </div>
    );
  }

  private renderProgress(): ReactNode {
    if (!this.uploadProgressLabel) return null;
    const percent = Math.max(4, Math.min(this.uploadProgressPercent ?? 0, 100));
    return (
      <div className={AdminClass.of('ext-progress')}>
        <div className={AdminClass.of('ext-progress__track')}>
          <div className={AdminClass.of('ext-progress__bar')} style={{ width: `${percent}%` }} />
        </div>
        {this.uploadProgressLabel}
      </div>
    );
  }

  private renderList(): ReactNode {
    const shown = this.filteredPlugins.filter((plugin) => this.filter.matches(plugin, this.hasPluginUpdate(plugin)));
    if (!shown.length) {
      return (
        <div className={`${AdminClass.of('ext-list')} ${AdminClass.of('ext-empty')}`}>
          {AdminI18n.t('plugins.list.noPluginsFound')}
          {this.searchQuery ? <> · {AdminI18n.t('plugins.list.tryADifferentSearchTerm2')}</> : null}
        </div>
      );
    }
    return (
      <div className={AdminClass.of('ext-list')}>
        {shown.map((plugin) => (
          <InstalledPluginCard key={plugin.manifest.slug} hasImageError={this.imageErrors[plugin.manifest.slug] ?? false}
            hasUpdate={this.hasPluginUpdate(plugin)} isDark={this.theme === ThemeMode.DARK} onDelete={this.onDeletePrompt}
            onImageError={this.markImageError} onNavigate={this.onNavigate} onToggle={this.handleToggle} plugin={plugin} canManage={this.canManage} />
        ))}
      </div>
    );
  }

  render(): ReactNode {
  return (
    <div className={AdminClass.of('ext-page')} onDragOver={this.onPageDragOver}>
      {this.operationStatus && (this.isUploading || this.isActivating) ? <Loader fullPage label={this.operationStatus.message} /> : null}
      {this.loading ? <div className="flex-1 flex items-center justify-center min-h-screen"><Loader label={AdminI18n.t('plugins.list.synchronizingGlobalMarketplaceCatalog')} /></div> : (
        <>
          {this.renderAlerts()}
          {this.siteScope ? <PlatformScopeGate what="" text={AdminI18n.t('plugins.list.platformNote')}>{null}</PlatformScopeGate> : null}
          {this.siteScope ? <SitePluginOffers /> : null}
          {this.siteScope ? <SiteOwnPlugins /> : null}
          {this.renderProgress()}
          {this.renderTabs()}
          {this.renderList()}
          {this.canManage && this.isDropActive ? (
            <div className={AdminClass.of('ext-drop')} onDragOver={this.handleDragOver} onDragLeave={this.handleDragLeave} onDrop={this.handleDrop}>
              <div className={AdminClass.of('ext-drop__box')}>
                <FrameworkIcons.Upload size={22} />
                {AdminI18n.t('ui.dropToInstall')}
              </div>
            </div>
          ) : null}
        </>
      )}
      <ConfirmDialog isOpen={this.showDeleteConfirm} onClose={this.closeDeleteConfirm} onConfirm={this.onDeleteConfirm} isLoading={this.isDeleting} title={AdminI18n.t('plugins.list.destroyPlugin')} description={this.deleteConfirmDescription} confirmLabel={AdminI18n.t('plugins.list.destroyNow')} />
      <DependencyDialog isOpen={this.showDependencyConfirm} onClose={this.closeDependencyConfirm} onConfirm={this.toggleDependencies} issues={this.dependencyIssues} pluginSlug={this.targetPlugin || ''} isLoading={this.isActivating} />
      <UploadPreviewDialog isOpen={this.showUploadPreview} title={this.uploadPreviewTitle} description={this.uploadPreviewDescription} sections={this.uploadPreviewSections} confirmLabel={AdminI18n.t('plugins.list.installPlugin')} cancelLabel={AdminI18n.t('plugins.list.cancel')} isLoading={this.isUploading} onClose={this.closeUploadPreview} onConfirm={this.confirmUploadPreview} />
    </div>
  );
  }
}
