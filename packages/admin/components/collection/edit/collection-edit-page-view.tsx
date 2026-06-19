"use client";

import React from 'react';

import { AdminCollectionUtils } from '@/lib/collection-utils';

import { EditHeader } from './edit-header';
import { RevisionModal } from './revision-modal';
import { EditFooter } from './edit-footer';
import { EditPageBody } from './edit-page-body';
import { EditPageDialogs } from './edit-page-dialogs';
import { EditCollectionNotFound } from './edit-collection-not-found';
import { CollectionEditPageLifecycle } from './collection-edit-page-lifecycle';
import { CollectionEditPageViewModelBuilder } from './collection-edit-page-view-model';
import type { CollectionEditPageViewProps, CollectionEditPageViewState } from './collection-edit-page.interfaces';

export class CollectionEditPageView extends React.Component<CollectionEditPageViewProps, CollectionEditPageViewState> {
  constructor(props: CollectionEditPageViewProps) {
    super(props);
    const collection = AdminCollectionUtils.resolveCollection(props.collections, props.pluginSlug, props.slug);
    const isNew = props.id === 'new';
    const duplicateFromId = isNew ? String(props.searchParams.get('duplicateFrom') || '').trim() : '';
    this.state = {
      pluginSettings: {}, status: null, loading: !isNew || Boolean(duplicateFromId), deleting: false, showDeleteConfirm: false,
      readOnlyOverrideFields: {}, readOnlyOverridePassword: '', readOnlyOverrideTarget: null, readOnlyOverridePasswordTarget: null, readOnlyOverrideVerifying: false,
      formData: {}, saving: false, fieldErrors: {}, slugManuallyEdited: false, slugWarning: null,
      activeTab: collection?.admin?.tabs?.[0]?.name || 'general',
      selectedRevision: null, activeVersionId: null, revisions: [], revisionsLoading: false, hasMoreRevisions: false,
      revisionPage: 1, showOnlyChanges: true, restoringPermanently: false, changeSummary: ''
    };
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

  updateState<K extends keyof CollectionEditPageViewState>(key: K, value: React.SetStateAction<CollectionEditPageViewState[K]>): void {
    this.setState((prev) => ({ [key]: typeof value === 'function' ? (value as any)(prev[key]) : value }) as Pick<CollectionEditPageViewState, K>);
  }

  render(): React.ReactNode {
    const { pluginSlug, slug, id } = this.props;
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

        <EditPageBody edit={edit} slug={slug} id={id} />

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
            router={edit.router}
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
