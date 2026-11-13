import { ThemeMode, CollectionArchive } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { PureReactor, prop, bound, state, Platform } from '@fromcode119/react-class-components';
import { AdminServices } from '@/lib/admin-services';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { Card } from '@/components/ui/view/card.client';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { EditHeaderRecordFacts } from '@/components/collection/edit/view/edit-header-record-facts.client';
import { EditHeaderMenu } from '@/components/collection/edit/view/edit-header-menu.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { SitePreviewLauncher } from '@/lib/tenants/site-preview-launcher';

/**
 * The top of a record page: where it sits (a breadcrumb back to its list), then one card naming it —
 * its title with a copy button, the facts its list shows beside it, its status, and the record's actions.
 *
 * Opened on one of its sections (`?section=`), the breadcrumb runs list › record › section, so the way
 * back to the whole record is the record's own name. The look is `admin.css` (`fc-record-head*`).
 */
export class EditHeader extends PureReactor {
  @prop declare collection: any;
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare id: string;
  @prop declare isNew: boolean;
  @prop declare theme: ThemeMode;
  @prop declare resolvedTitleValue: string;
  @prop declare formData: any;
  @prop declare setFormData: (value: any) => void;
  @prop declare getPreviewUrl: () => string;
  @prop declare showPreview: boolean;
  @prop declare statusOptions: { label: string; value: string }[];
  @prop declare currentStatusValue: string;
  /** The status option's label, shown as a badge whether or not it may be changed here. */
  @prop declare currentStatusLabel: string;
  @prop declare handleInputChange: (name: string, value: any) => void;
  @prop declare handleSubmit: (e: any, summary: string) => void;
  @prop declare saving: boolean;
  @prop declare setShowDeleteConfirm: (val: boolean) => void;
  /** Whether the signed-in user may save this record (create when new, update otherwise). */
  @prop declare canSave: boolean;
  /**
   * Unsaved changes on the page. A saved record is changed a section at a time, each sheet saving itself,
   * so the page-wide Save appears only when something outside a sheet (a status, an inline table) changed.
   */
  @prop declare isDirty?: boolean;
  /** Whether the signed-in user may delete it. */
  @prop declare canDelete: boolean;
  /** Which plugin-contributed header actions to offer — see `CollectionAccess.allowsPluginAction`. */
  @prop declare includeAction: (contribution: { pluginSlug: string }) => boolean;
  @prop declare advancedView: boolean;
  @prop declare setAdvancedView: (next: boolean) => void;
  /** The section opened on its own page, for the breadcrumb; null on the record itself. */
  @prop declare focusedSection: { key: string; title: string } | null;

  /** Where this tab last showed the list (its page); read after mount, so server and client render alike. */
  @state listHref = '';
  @state private copied = false;

  componentDidMount(): void {
    this.listHref = AdminServices.getInstance().uiPreference.readCollectionListHref(this.pluginSlug, this.slug);
  }

  private get collectionLabel(): string {
    return CollectionListUtils.resolveCollectionLabel(this.collection, this.slug);
  }

  private get title(): string {
    const name = CollectionListUtils.resolveCollectionSingularLabel(this.collection, this.slug);
    if (this.isNew) return AdminI18n.t('collection.edit.createTitle', { name, label: this.collectionLabel });
    return this.resolvedTitleValue || AdminI18n.t('collection.edit.untitled', { name });
  }

  @bound private onStatusChange(value: string): void {
    this.handleInputChange('status', value);
  }

  @bound private onSave(e: any): void {
    this.handleSubmit(e, '');
  }

  @bound private onDelete(): void {
    this.setShowDeleteConfirm(true);
  }

  @bound private async onCopy(): Promise<void> {
    if (!Platform.isBrowser) return;
    await navigator.clipboard.writeText(this.title);
    this.copied = true;
    window.setTimeout(() => { this.copied = false; }, 1500);
  }

  /**
   * Preview goes through the site's preview link, not straight to the page: on a site's own host the
   * console session is never sent, so a draft opened directly answers "Page not found". The href stays
   * so the address is visible and copyable; the click is what opens it with access.
   */
  @bound private onPreviewClick(e: any): void {
    e.preventDefault();
    void SitePreviewLauncher.openRecord(this.getPreviewUrl()).catch((error) => {
      console.error('Opening the preview failed:', error);
    });
  }

  private renderCrumbs(head: string): ReactNode {
    const recordHref = `/${this.pluginSlug}/${this.slug}/${this.id}`;
    const section = this.focusedSection;
    return (
      <nav className={`${head}-crumbs`} aria-label={AdminI18n.t('collection.edit.breadcrumb')}>
        <AdminLink href={this.listHref || `/${this.pluginSlug}/${this.slug}`} className={`${head}-crumbs__link`}>
          <FrameworkIcons.Left size={14} />
          {this.collectionLabel}
        </AdminLink>
        <span className={`${head}-crumbs__sep`} aria-hidden="true">›</span>
        {section ? (
          <>
            <AdminLink href={recordHref} className={`${head}-crumbs__link`}>{this.title}</AdminLink>
            <span className={`${head}-crumbs__sep`} aria-hidden="true">›</span>
            <span className={`${head}-crumbs__current`} aria-current="page">{section.title}</span>
          </>
        ) : (
          <span className={`${head}-crumbs__current`} aria-current="page">{this.title}</span>
        )}
      </nav>
    );
  }

  render(): ReactNode {
    const { collection, slug, isNew, formData, setFormData, handleSubmit, saving } = this;
    const head = AdminClass.of('record-head');
    const facts = isNew ? [] : EditHeaderRecordFacts.of(collection, formData);
    const archived = !isNew && CollectionArchive.isArchived(formData);
    const slotProps = { collection, formData, setFormData, isNew, handleSubmit, saving };

    return (
      <div className={`${head}-top`}>
        {this.renderCrumbs(head)}
        <Card noPadding className={head}>
          <div className={`${head}__main`}>
            <div className={`${head}__title-row`}>
              <h1 className={`${head}__title`} title={this.title}>{this.title}</h1>
              {!isNew && this.resolvedTitleValue ? (
                <button type="button" onClick={this.onCopy} className={`${head}__copy`}
                  aria-label={AdminI18n.t(this.copied ? 'collection.edit.copied' : 'collection.edit.copyTitle')}
                  title={AdminI18n.t(this.copied ? 'collection.edit.copied' : 'collection.edit.copyTitle')}>
                  {this.copied ? <FrameworkIcons.Check size={14} /> : <FrameworkIcons.Copy size={14} />}
                </button>
              ) : null}
              {!isNew && this.currentStatusLabel ? <span className={`${head}__badge`}>{this.currentStatusLabel}</span> : null}
              {archived ? <span className={`${head}__badge ${head}__badge--muted`}>{AdminI18n.t('collection.list.viewArchived')}</span> : null}
            </div>
            {isNew
              ? <p className={`${head}__meta`}>{AdminI18n.t('collection.edit.newSubtitle', { name: this.collectionLabel.toLowerCase(), label: this.collectionLabel })}</p>
              : facts.length > 0 ? <p className={`${head}__meta`}>{facts.join(' · ')}</p> : null}
          </div>

          <div className={`${head}__actions`}>
            {formData?.scheduledPublishAt && (formData.status === 'draft' || !formData.status) ? (
              <span className={`${head}__badge`}>
                <FrameworkIcons.Clock size={12} />
                {new Date(formData.scheduledPublishAt).toLocaleDateString()}
              </span>
            ) : null}
            {this.showPreview ? (
              <a href={this.getPreviewUrl()} onClick={this.onPreviewClick} target="_blank" rel="noopener noreferrer"
                aria-label={AdminI18n.t('collection.edit.preview')} className={`${head}__button`}>
                <FrameworkIcons.Eye size={14} />
                <span className={`${head}__button-label`}>{AdminI18n.t('collection.edit.preview')}</span>
              </a>
            ) : null}
            <Slot name={`admin.collection.${slug}.edit.header.actions`} include={this.includeAction} props={slotProps} />
            <Slot name="admin.collection.edit.header.actions" include={this.includeAction} props={slotProps} />
            {collection?.admin?.hideHeaderPrimaryAction !== true && this.canSave && (isNew || this.isDirty) ? (
              <Button onClick={this.onSave} isLoading={saving} icon={<FrameworkIcons.Save size={14} />}>
                {AdminI18n.t(isNew ? 'common.create' : 'common.save')}
              </Button>
            ) : null}
            {isNew ? null : (
              <EditHeaderMenu
                collection={collection} id={this.id} formData={formData} setFormData={setFormData}
                statusOptions={this.statusOptions} currentStatusValue={this.currentStatusValue} onStatusChange={this.onStatusChange}
                advancedView={this.advancedView} setAdvancedView={this.setAdvancedView}
                canArchive={this.canSave && CollectionArchive.isArchivable(collection)}
                canDelete={this.canDelete} onDelete={this.onDelete}
              />
            )}
          </div>
        </Card>
      </div>
    );
  }
}
