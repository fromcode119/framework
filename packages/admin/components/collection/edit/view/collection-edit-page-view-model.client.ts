import { CollectionEditDerivations } from '@/components/collection/edit/view/collection-edit-derivations.client';
import { CollectionEditPageHandlers } from '@/components/collection/edit/view/collection-edit-page-handlers.client';
import type { ICollectionEditPageViewModel } from '@/components/collection/edit/interfaces/collection-edit-page-view-model.interface';

/**
 * Assembles the `CollectionEditPageViewModel` consumed by the edit-page subcomponents (header, body,
 * footer, dialogs, revision modal). `self` is the `CollectionEditPageView` instance, typed loosely to
 * avoid a circular import. Setters wrap `self.updateState`; handlers delegate to the handler class.
 */
export class CollectionEditPageViewModelBuilder {
  static build(self: any): ICollectionEditPageViewModel {
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
      // `setFormData` is handed to plugin slot/field components, whose prop type is React's
      // `Dispatch<SetStateAction<Record<string, any>>>` — so they legitimately call it with an UPDATER
      // FUNCTION (`setFormData(prev => ({ ...prev, x }))`). Passing that straight to `updateState`
      // stored the FUNCTION as `formData`; every field then read from a function (no own keys) and the
      // whole form rendered blank. On the orders screen `EcommerceOrderSyncStatus` does exactly this,
      // which is why orders came up empty while collections without such a component were fine.
      // NOTE: the `typeof v === 'function'` test is not a defensive contract guard — `SetStateAction`
      // is a value|updater union, so discriminating it is the contract.
      formData: s.formData,
      setFormData: (v) => self.setState((prev: any) => ({
        formData: typeof v === 'function' ? (v as (p: any) => any)(prev.formData) : v,
      })),
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
