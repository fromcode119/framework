"use client";

import { CollectionEditDerivations } from './collection-edit-derivations';
import { CollectionEditPageHandlers } from './collection-edit-page-handlers';
import type { CollectionEditPageViewModel } from './collection-edit-page.interfaces';

/**
 * Assembles the `CollectionEditPageViewModel` consumed by the edit-page subcomponents (header, body,
 * footer, dialogs, revision modal). `self` is the `CollectionEditPageView` instance, typed loosely to
 * avoid a circular import. Setters wrap `self.updateState`; handlers delegate to the handler class.
 */
export class CollectionEditPageViewModelBuilder {
  static build(self: any): CollectionEditPageViewModel {
    const d = CollectionEditDerivations.build(self);
    const s = self.state;
    return {
      router: self.props.router, theme: self.props.theme, settings: self.props.settings,
      collection: d.collection, resolvedSlug: d.resolvedSlug, isNew: d.isNew,
      pluginSettings: s.pluginSettings,
      status: s.status, setStatus: (v) => self.updateState('status', v),
      deleting: s.deleting,
      showDeleteConfirm: s.showDeleteConfirm, setShowDeleteConfirm: (v) => self.updateState('showDeleteConfirm', v),
      readOnlyOverrideFields: s.readOnlyOverrideFields,
      readOnlyOverrideTarget: s.readOnlyOverrideTarget, setReadOnlyOverrideTarget: (v) => self.updateState('readOnlyOverrideTarget', v),
      readOnlyOverridePasswordTarget: s.readOnlyOverridePasswordTarget, setReadOnlyOverridePasswordTarget: (v) => self.updateState('readOnlyOverridePasswordTarget', v),
      readOnlyOverrideVerifying: s.readOnlyOverrideVerifying,
      formData: s.formData, setFormData: (v) => self.updateState('formData', v),
      handleSubmit: (e, summary) => CollectionEditPageHandlers.handleSubmit(self, e, summary),
      saving: s.saving, fieldErrors: s.fieldErrors,
      resolvedTitleValue: d.resolvedTitleValue, slugManuallyEdited: s.slugManuallyEdited, slugWarning: s.slugWarning,
      activeTab: s.activeTab, setActiveTab: (v) => self.updateState('activeTab', v),
      selectedRevision: s.selectedRevision, setSelectedRevision: (v) => self.updateState('selectedRevision', v),
      activeVersionId: s.activeVersionId, setActiveVersionId: (v) => self.updateState('activeVersionId', v),
      revisions: s.revisions, revisionsLoading: s.revisionsLoading, hasMoreRevisions: s.hasMoreRevisions,
      showOnlyChanges: s.showOnlyChanges, setShowOnlyChanges: (v) => self.updateState('showOnlyChanges', v),
      restoringPermanently: s.restoringPermanently,
      changeSummary: s.changeSummary, setChangeSummary: (v) => self.updateState('changeSummary', v),
      currentRevIndex: d.currentRevIndex,
      loadMoreRevisions: () => CollectionEditPageHandlers.loadMoreRevisions(self),
      handleHardRestore: (version) => CollectionEditPageHandlers.handleHardRestore(self, version),
      getPreviewUrl: () => CollectionEditPageHandlers.getPreviewUrl(self),
      sidebarFieldSections: d.sidebarFieldSections, standardMainFieldSections: d.standardMainFieldSections,
      fullWidthMainFieldSections: d.fullWidthMainFieldSections, navSections: d.navSections,
      handleInputChange: (name, value) => CollectionEditPageHandlers.handleInputChange(self, name, value),
      handlePatch: (partial) => CollectionEditPageHandlers.handlePatch(self, partial),
      handleDelete: () => CollectionEditPageHandlers.handleDelete(self),
      handleReadOnlyOverrideRequest: (target) => CollectionEditPageHandlers.handleReadOnlyOverrideRequest(self, target),
      openReadOnlyOverridePasswordPrompt: () => CollectionEditPageHandlers.openReadOnlyOverridePasswordPrompt(self),
      handleReadOnlyOverridePasswordConfirm: (password) => CollectionEditPageHandlers.handleReadOnlyOverridePasswordConfirm(self, password),
      hasDisablePermalink: d.hasDisablePermalink, showPreview: d.showPreview, showPermalink: d.showPermalink,
      isFullWidth: d.isFullWidth, hideFooter: d.hideFooter, hasSidebarFields: d.hasSidebarFields,
      renderSidebar: d.renderSidebar, hasBuiltInSidebarContent: d.hasBuiltInSidebarContent,
      statusOptions: d.statusOptions, currentStatusValue: d.currentStatusValue
    };
  }
}
