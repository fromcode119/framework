import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/reactor';

import { AdminCollectionUtils } from '@/lib/collection-utils';

import { EditHeader } from '@/components/collection/edit/view/edit-header.client';
import { RevisionModal } from '@/components/collection/edit/view/revision-modal.client';
import { EditFooter } from '@/components/collection/edit/view/edit-footer.client';
import { EditPageBody } from '@/components/collection/edit/edit-page-body';
import { EditPageDialogs } from '@/components/collection/edit/edit-page-dialogs';
import { EditCollectionNotFound } from '@/components/collection/edit/edit-collection-not-found';
import { CollectionEditPageLifecycle } from '@/components/collection/edit/view/collection-edit-page-lifecycle.client';
import { CollectionEditPageViewModelBuilder } from '@/components/collection/edit/view/collection-edit-page-view-model.client';

export class CollectionEditPageView extends Reactor {
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare id: string;
  @prop declare router: any;
  @prop declare searchParams: URLSearchParams;
  @prop declare collections: any;
  @prop declare settings: any;
  @prop declare theme: any;

  @state pluginSettings: Record<string, any> = {};
  @state pluginSettingsSchema: Record<string, any> = {};
  @state status: { type: NotificationType; message: string } | null = null;
  @state loading = !this.isNewEntry || Boolean(this.duplicateFromId);
  @state deleting = false;
  @state showDeleteConfirm = false;
  /** Form vs JSON view. Owned here; switched from the body's EditViewModeRail. */
  @state advancedView = false;

  @bound private setAdvancedView(next: boolean): void {
    this.advancedView = next;
  }

  @state readOnlyOverrideFields: Record<string, true> = {};
  @state readOnlyOverridePassword = '';
  @state readOnlyOverrideTarget: { name: string; label: string } | null = null;
  @state readOnlyOverridePasswordTarget: { name: string; label: string } | null = null;
  @state readOnlyOverrideVerifying = false;
  @state formData: Record<string, any> = {};
  /**
   * The record exactly as loaded (and as last saved). `formData` is compared against this to tell
   * whether there is anything to save — see {@link CollectionEditDirtyState}. `null` until a record
   * loads, which is why a failed load claims no unsaved changes.
   */
  @state pristineFormData: Record<string, any> | null = null;
  @state saving = false;
  @state fieldErrors: Record<string, string[]> = {};
  @state slugManuallyEdited = false;
  @state slugWarning: string | null = null;
  @state activeTab = this.initialActiveTab;
  @state selectedRevision: any | null = null;
  @state activeVersionId: number | null = null;
  @state revisions: any[] = [];
  @state revisionsLoading = false;
  @state hasMoreRevisions = false;
  @state revisionPage = 1;
  @state showOnlyChanges = true;
  @state restoringPermanently = false;
  @state changeSummary = '';

  private get isNewEntry(): boolean {
    return this.id === 'new';
  }

  private get duplicateFromId(): string {
    return this.isNewEntry ? String(this.searchParams.get('duplicateFrom') || '').trim() : '';
  }

  private get initialActiveTab(): string {
    const collection = AdminCollectionUtils.resolveCollection(this.collections, this.pluginSlug, this.slug);
    return collection?.admin?.tabs?.[0]?.name || 'general';
  }

  componentDidMount(): void {
    CollectionEditPageLifecycle.onMount(this);
  }

  componentDidUpdate(): void {
    CollectionEditPageLifecycle.run(this);
  }

  componentWillUnmount(): void {
    CollectionEditPageLifecycle.onUnmount(this);
  }

  updateState(key: string, value: unknown): void {
    (this as unknown as Record<string, unknown>)[key] = value;
  }

  render(): ReactNode {
    const pluginSlug = this.pluginSlug;
    const slug = this.slug;
    const id = this.id;
    const edit = CollectionEditPageViewModelBuilder.build(this);
    const collection = edit.collection;
    if (!collection) return <EditCollectionNotFound theme={edit.theme} slug={slug} pluginSlug={pluginSlug} />;

    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
        <EditHeader
          collection={collection} pluginSlug={pluginSlug} slug={slug} id={id} isNew={edit.isNew} theme={edit.theme}
          resolvedTitleValue={edit.resolvedTitleValue} changeSummary={edit.changeSummary} setChangeSummary={edit.setChangeSummary}
          formData={edit.formData} setFormData={edit.setFormData} getPreviewUrl={edit.getPreviewUrl} showPreview={edit.showPreview}
          statusOptions={edit.statusOptions} currentStatusValue={edit.currentStatusValue} handleInputChange={edit.handleInputChange}
          handleSubmit={edit.handleSubmit} saving={edit.saving} setShowDeleteConfirm={edit.setShowDeleteConfirm}
        />

        <EditPageBody
          edit={edit} slug={slug} id={id}
          advancedView={this.advancedView} setAdvancedView={this.setAdvancedView}
        />

        <RevisionModal
          selectedRevision={edit.selectedRevision} setSelectedRevision={edit.setSelectedRevision}
          showOnlyChanges={edit.showOnlyChanges} setShowOnlyChanges={edit.setShowOnlyChanges}
          formData={edit.formData} setFormData={edit.setFormData} theme={edit.theme} currentRevIndex={edit.currentRevIndex}
          revisions={edit.revisions} restoringPermanently={edit.restoringPermanently} handleHardRestore={edit.handleHardRestore}
          setActiveVersionId={edit.setActiveVersionId} setStatus={edit.setStatus}
        />

        {!edit.hideFooter && (
          <EditFooter
            collection={collection} theme={edit.theme} isNew={edit.isNew} discardHref={`/${pluginSlug}/${slug}`}
            handleSubmit={edit.handleSubmit} changeSummary={edit.changeSummary} setChangeSummary={edit.setChangeSummary} saving={edit.saving}
            router={edit.router} isDirty={edit.isDirty}
          />
        )}

        <EditPageDialogs
          readOnlyOverrideTarget={edit.readOnlyOverrideTarget} setReadOnlyOverrideTarget={edit.setReadOnlyOverrideTarget}
          openReadOnlyOverridePasswordPrompt={edit.openReadOnlyOverridePasswordPrompt}
          readOnlyOverridePasswordTarget={edit.readOnlyOverridePasswordTarget} setReadOnlyOverridePasswordTarget={edit.setReadOnlyOverridePasswordTarget}
          handleReadOnlyOverridePasswordConfirm={edit.handleReadOnlyOverridePasswordConfirm} readOnlyOverrideVerifying={edit.readOnlyOverrideVerifying}
          showDeleteConfirm={edit.showDeleteConfirm} setShowDeleteConfirm={edit.setShowDeleteConfirm} handleDelete={edit.handleDelete} deleting={edit.deleting}
        />
      </div>
    );
  }
}
