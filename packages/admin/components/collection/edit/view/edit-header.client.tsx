import { ThemeMode, CollectionArchive } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound, state } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Card } from '@/components/ui/view/card.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { EditHeaderRecordFacts } from '@/components/collection/edit/view/edit-header-record-facts.client';
import { EditHeaderMenu } from '@/components/collection/edit/view/edit-header-menu.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { ClipboardCopy } from '@/lib/clipboard-copy';
import { SitePreviewLauncher } from '@/lib/tenants/site-preview-launcher';

/**
 * The card naming a record, at the top of its main column: its title with a copy button, the line of
 * facts under it, its state badges, and the record's actions. Where the record sits (the way back to
 * its list) is `EditRecordCrumbs`, above both columns. The look is `admin.css` (`fc-record-head*`).
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
  /** `confirm`: what choosing the option sets off, said in the question asked before it is saved. */
  @prop declare statusOptions: { label: string; value: string; tone?: string; confirm?: string }[];
  @prop declare currentStatusValue: string;
  /** The status option's label, shown as a badge whether or not it may be changed here. */
  @prop declare currentStatusLabel: string;
  @prop declare currentStatusTone?: string;
  @prop declare handleInputChange: (name: string, value: any) => void;
  @prop declare handleSubmit: (e: any, summary: string) => void;
  /** Saves the record with a status chosen from the ⋯ menu. */
  @prop declare commitStatus?: (value: string) => Promise<void>;
  @prop declare saving: boolean;
  @prop declare setShowDeleteConfirm: (val: boolean) => void;
  /** Whether the signed-in user may save this record (create when new, update otherwise). */
  @prop declare canSave: boolean;
  /**
   * Unsaved changes on the page. A saved record is changed a section at a time, each sheet saving itself,
   * so the page-wide Save appears only when something outside a sheet (a status, an inline table) changed.
   */
  @prop declare isDirty?: boolean;
  /**
   * The page has its save bar (Cancel / Save at the foot, shown whenever there is something to save). Then
   * the header offers no Save of its own: two buttons doing one save is one too many.
   */
  @prop declare saveBar?: boolean;
  /** Whether the signed-in user may delete it. */
  @prop declare canDelete: boolean;
  /** Which plugin-contributed header actions to offer — see `CollectionAccess.allowsPluginAction`. */
  @prop declare includeAction: (contribution: { pluginSlug: string }) => boolean;
  @prop declare advancedView: boolean;
  @prop declare setAdvancedView: (next: boolean) => void;
  /** Sections holding fields the record does not draw; each opens in place from the ⋯ menu. */
  /** The sections already opened in place, which a newly opened one joins. */
  @prop declare openedSections?: string[];
  /** The record's own address, which those menu rows extend with the section they open. */
  @prop declare recordHref?: string;
  @prop declare navigate?: (href: string) => void;
  /** Render the header's content WITHOUT its own card — for when it is the head of the first section's
      card (the merged first card the reference draws). */
  @prop declare bare?: boolean;
  /** Edit the first section, offered as the first item of this header's ⋯ when it heads the first card. */
  @prop declare onEditDetails?: () => void;
  @state private copied = '';
  /** The status chosen from the menu, waiting for the operator to confirm it. */
  @state private askedStatus: { label: string; value: string; tone?: string; confirm?: string } | null = null;
  @state private committing = false;

  private get collectionLabel(): string {
    return CollectionListUtils.resolveCollectionLabel(this.collection, this.slug);
  }

  private get title(): string {
    const name = CollectionListUtils.resolveCollectionSingularLabel(this.collection, this.slug);
    if (this.isNew) return AdminI18n.t('collection.edit.createTitle', { name, label: this.collectionLabel });
    return this.resolvedTitleValue || AdminI18n.t('collection.edit.untitled', { name });
  }

  /**
   * A status chosen from the ⋯ menu is a decision about the record, so it is asked and saved at once —
   * with what it sets off (the option's `confirm`), since a move can email the customer or give stock
   * back. It used to change only the form: the page showed nothing new but an "Unsaved changes" bar.
   * With other edits still unsaved it joins them instead, so one Save does not commit work unasked.
   */
  @bound private onStatusChange(value: string): void {
    const option = this.statusOptions.find((candidate) => candidate.value === value);
    if (!option || value === this.currentStatusValue) return;
    if (!this.commitStatus || this.isDirty) {
      this.handleInputChange('status', value);
      return;
    }
    this.askedStatus = option;
  }

  @bound private async onStatusConfirm(): Promise<void> {
    const asked = this.askedStatus;
    if (!asked || !this.commitStatus || this.committing) return;
    this.committing = true;
    try {
      await this.commitStatus(asked.value);
    } catch {
      // A refused save is already on screen (the save bar's message); the stored status is kept.
    } finally {
      this.committing = false;
      this.askedStatus = null;
    }
  }

  @bound private onSave(e: any): void {
    // A refused save is already on screen (the save bar's message, the fields' errors); nothing awaits it here.
    Promise.resolve(this.handleSubmit(e, '')).catch(() => undefined);
  }

  @bound private onDelete(): void {
    this.setShowDeleteConfirm(true);
  }

  @bound private async onCopy(): Promise<void> {
    this.copied = await ClipboardCopy.write(this.title);
    window.setTimeout(() => { this.copied = ''; }, ClipboardCopy.SHOWN_MS);
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

  /** The declared state badges, each a dot in its option's tone; the record's status when none is declared. */
  private renderBadges(): ReactNode {
    if (this.isNew) return null;
    const badges = EditHeaderRecordFacts.badges(this.collection, this.formData)
      ?? (this.currentStatusLabel ? [{ key: 'status', label: this.currentStatusLabel, tone: this.currentStatusTone || 'default' }] : []);
    return badges.map((badge) => <StateBadge key={badge.key} tone={badge.tone}>{badge.label}</StateBadge>);
  }

  render(): ReactNode {
    const { collection, slug, isNew, formData, setFormData, handleSubmit, saving } = this;
    const head = AdminClass.of('record-head');
    const facts = isNew ? [] : EditHeaderRecordFacts.of(collection, formData);
    const archived = !isNew && CollectionArchive.isArchived(formData);
    const slotProps = { collection, formData, setFormData, isNew, handleSubmit, saving };

    const inner = (
      <>
        <div className={`${head}__main`}>
          <div className={`${head}__title-row`}>
            <h1 className={`${head}__title`} title={this.title}>{this.title}</h1>
            {!isNew && this.resolvedTitleValue ? (
              <button type="button" onClick={this.onCopy} className={`${head}__copy`}
                aria-label={AdminI18n.t(ClipboardCopy.labelKey(this.copied))}
                title={AdminI18n.t(ClipboardCopy.labelKey(this.copied))}>
                {this.copied === ClipboardCopy.COPIED ? <FrameworkIcons.Check size={14} /> : <FrameworkIcons.Copy size={14} />}
              </button>
            ) : null}
            {archived ? <span className={`${head}__badge ${head}__badge--muted`}>{AdminI18n.t('collection.list.viewArchived')}</span> : null}
          </div>
          {isNew
            ? <p className={`${head}__meta`}>{AdminI18n.t('collection.edit.newSubtitle', { name: this.collectionLabel.toLowerCase(), label: this.collectionLabel })}</p>
            : facts.length > 0 ? <p className={`${head}__meta`}>{facts.join(' · ')}</p> : null}
        </div>

        <div className={`${head}__actions`}>
          {this.renderBadges()}
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
          {collection?.admin?.hideHeaderPrimaryAction !== true && !this.saveBar && this.canSave && (isNew || this.isDirty) ? (
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
              canDelete={this.canDelete} onDelete={this.onDelete} onEditDetails={this.onEditDetails}
              openedSections={this.openedSections || []} recordHref={this.recordHref || ''} navigate={this.navigate}
              actions={(
                <>
                  <Slot name={`admin.collection.${slug}.edit.header.menu`} include={this.includeAction} props={slotProps} />
                  <Slot name="admin.collection.edit.header.menu" include={this.includeAction} props={slotProps} />
                </>
              )}
            />
          )}
        </div>
        {this.askedStatus ? (
          <ConfirmDialog isOpen onClose={() => { if (!this.committing) this.askedStatus = null; }} onConfirm={() => void this.onStatusConfirm()}
            title={AdminI18n.t('collection.edit.statusConfirm', { status: this.askedStatus.label })}
            description={this.askedStatus.confirm || ''} isLoading={this.committing}
            variant={this.askedStatus.tone === 'danger' ? ButtonVariant.DANGER : ButtonVariant.PRIMARY} />
        ) : null}
      </>
    );
    return this.bare ? inner : <Card noPadding className={head}>{inner}</Card>;
  }
}
