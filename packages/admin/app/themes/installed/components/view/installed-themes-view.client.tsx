import { ThemeMode } from '@fromcode119/core/client';
import { Button } from '@/components/ui/view/button.client';
import { Loader } from '@/components/ui/view/loader.client';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { PureReactor, prop, bound, Ref } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { UploadPreviewDialog } from '@/components/ui/view/upload-preview-dialog.client';
import { InstalledThemeCard } from '@/app/themes/installed/components/view/installed-theme-card.client';
import type { IInstalledThemeManifest } from '@/app/themes/installed/interfaces/installed-theme-manifest.interface';
import type { IInstalledThemesSiteQuota } from '@/app/themes/installed/interfaces/installed-themes-site-quota.interface';
import { IUploadPreviewSection } from '@/components/ui/interfaces/upload-preview-section.interface';
import { ThemeState } from '@fromcode119/core/client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class InstalledThemesView extends PureReactor {
  /** False for a tenant admin on a multi-tenant deployment: no upload, no activate/delete. */
  @prop declare canManage: boolean;
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
  /** In a site: uploads go into its own directory, and its own themes can be removed there. */
  @prop declare siteScope: boolean;
  @prop declare siteQuota: IInstalledThemesSiteQuota | null;
  @prop declare onDeleteMine: (slug: string, isActive: boolean) => Promise<void>;
  @prop declare showUploadPreview: boolean;
  @prop declare themes: IInstalledThemeManifest[];
  @prop declare themeMode: ThemeMode;
  @prop declare uploadProgressLabel: string | null;
  @prop declare uploadProgressPercent: number | null;
  @prop declare uploadPreviewDescription: string;
  @prop declare uploadPreviewSections: IUploadPreviewSection[];
  @prop declare uploadPreviewTitle: string;
  @prop declare onNavigate: (href: string) => void;
  @prop declare updateVersionForTheme: (theme: IInstalledThemeManifest) => string | null;

  /** A file dragged from outside, not a row or a text selection dragged inside the page. */
  @bound
  private onPageDragOver(event: DragEvent<HTMLDivElement>): void {
    if (!this.canUpload || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    this.handleDragOver(event);
  }

  /** Two uploads, never both: in Platform scope into the directory every site renders from (a platform
      admin's); in a site into that site's own directory, where only it can see the theme. */
  private get canUpload(): boolean {
    return this.canManage || this.siteScope;
  }

  private row(theme: IInstalledThemeManifest): ReactNode {
    return (
      <InstalledThemeCard key={theme.slug} onActivate={this.onActivate} onDisable={this.onDisable} onDelete={this.onDelete}
        onDeleteMine={this.onDeleteMine} onUpdate={this.onUpdate} onNavigate={this.onNavigate} theme={theme}
        updateVersion={this.updateVersionForTheme(theme)} canManage={this.canManage}
        ownedBySite={this.siteScope && Boolean(theme.ownerTenantId)} />
    );
  }

  private renderToolbar(): ReactNode {
    if (!this.canUpload) return null;
    const { siteScope, siteQuota } = this;
    const note = siteScope
      ? `${AdminI18n.t('themes.onlyThisSiteSeesIt')}${siteQuota ? ` ${AdminI18n.t('themes.thisSiteHoldsOfThemes', { themes: siteQuota.themes, maxThemes: siteQuota.maxThemes, round: Math.round(siteQuota.maxBytes / (1024 * 1024)) })}` : ''}`
      : '';
    return (
      <div className={AdminClass.of('ext-toolbar')}>
        <input type="file" ref={this.fileInputRef} onChange={this.handleFileChange} className="hidden" accept=".zip,.tar.gz,.tgz,application/zip,application/gzip,application/x-gzip" />
        <Button onClick={this.handleUploadClick} isLoading={this.isUploading || this.isInspectingUpload}>
          {this.isInspectingUpload ? AdminI18n.t('themes.inspecting') : siteScope ? AdminI18n.t('themes.uploadForThisSite') : AdminI18n.t('themes.uploadThemeZipTarGz')}
        </Button>
        {note ? <span className={AdminClass.of('ext-toolbar__note')} title={note}>{note}</span> : null}
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

  private renderThemes(): ReactNode {
    const themes = this.themes;
    if (!themes.length) {
      return <div className={`${AdminClass.of('ext-list')} ${AdminClass.of('ext-empty')}`}>{AdminI18n.t('themes.noThemesInstalled')}</div>;
    }
    // `themes` is API JSON, so `state` is a raw string here — resolve before comparing to a member.
    const isActive = (theme: IInstalledThemeManifest) => ThemeState.resolve(theme.state) === ThemeState.ACTIVE;
    const active = themes.filter(isActive);
    const others = themes.filter((theme) => !isActive(theme));
    return (
      <>
        <h2 className={`${AdminClass.of('ext-section')} ${AdminClass.of('ext-section--first')}`}>{AdminI18n.t('themes.activeTheme')}</h2>
        {active.length
          ? <div className={AdminClass.of('ext-list')}>{active.map((theme) => this.row(theme))}</div>
          : <div className={`${AdminClass.of('ext-list')} ${AdminClass.of('ext-empty')}`}>{AdminI18n.t('themes.noActiveTheme')}</div>}
        {others.length ? (
          <>
            <h2 className={AdminClass.of('ext-section')}>{AdminI18n.t('themes.otherThemes')}</h2>
            <div className={AdminClass.of('ext-list')}>{others.map((theme) => this.row(theme))}</div>
          </>
        ) : null}
      </>
    );
  }

  render(): ReactNode {
  if (this.loading) {
    return <div className={`${AdminClass.of('ext-list')} ${AdminClass.of('ext-empty')}`}><Loader label={AdminI18n.t('themes.installed')} /></div>;
  }

  return (
    <div className={AdminClass.of('ext-page')} onDragOver={this.onPageDragOver}>
      {this.renderToolbar()}
      {this.renderProgress()}
      {this.renderThemes()}
      {this.canUpload && this.isDropActive ? (
        <div className={AdminClass.of('ext-drop')} onDragOver={this.handleDragOver} onDragLeave={this.handleDragLeave} onDrop={this.handleDrop}>
          <div className={AdminClass.of('ext-drop__box')}>
            <FrameworkIcons.Upload size={22} />
            {AdminI18n.t('ui.dropToInstall')}
          </div>
        </div>
      ) : null}
      <UploadPreviewDialog isOpen={this.showUploadPreview} title={this.uploadPreviewTitle} description={this.uploadPreviewDescription} sections={this.uploadPreviewSections} confirmLabel={AdminI18n.t('themes.installTheme2')} cancelLabel={AdminI18n.t('themes.cancel')} isLoading={this.isUploading} onClose={this.closeUploadPreview} onConfirm={this.confirmUploadPreview} />
    </div>
  );
  }
}
