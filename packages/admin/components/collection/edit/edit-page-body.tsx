import { NotificationType } from '@/components/enums/notification-type.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { EditPageMain } from '@/components/collection/edit/edit-page-main';
import { CollectionRecordLinksDeclaration } from '@/components/collection/edit/collection-record-links-declaration';
import { CollectionRecordLinksPanel } from '@/components/collection/edit/collection-record-links-panel.client';
import { EditStickyColumn } from '@/components/collection/edit/view/edit-sticky-column.client';
import { EditPageSidebar } from '@/components/collection/edit/edit-page-sidebar';
import { RecordJsonView } from '@/components/collection/edit/view/record-json-view.client';
import { EditRecordMoreCard } from '@/components/collection/edit/view/edit-record-more-card.client';
import type { ICollectionEditPageViewModel } from '@/components/collection/edit/interfaces/collection-edit-page-view-model.interface';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class EditPageBody extends PureReactor {
  @prop declare edit: ICollectionEditPageViewModel;
  @prop declare slug: string;
  @prop declare id: string;
  /** Owned by the page view; switched from the header's record menu. */
  @prop declare advancedView: boolean;
  /** The record's own address, which the "More" rows extend with the section they open. */
  @prop declare recordHref: string;

  render(): ReactNode {
    const { edit, slug, id } = this;
    const {
      status, setStatus, formData, setFormData, isNew, handleSubmit, saving, collection, theme,
      activeTab, setActiveTab, renderSidebar, resolvedSlug, pluginSettings, pluginSettingsSchema, fieldErrors,
      slugWarning, slugManuallyEdited, readOnlyOverrideGranted, handleInputChange, handlePatch,
      handleReadOnlyOverrideRequest, standardMainFieldSections, fullWidthMainFieldSections,
      showPermalink, hasDisablePermalink, hasSidebarFields, sidebarFieldSections, hasBuiltInSidebarContent,
      revisions, revisionsLoading, activeVersionId, setSelectedRevision, setActiveVersionId,
      loadMoreRevisions, hasMoreRevisions
    } = edit;

    // A new record can offer none of the correlation keys, so there is no question to ask yet.
    const recordLinks = isNew ? null : CollectionRecordLinksDeclaration.of(collection, formData, String(id));
    const navigate = (href: string) => edit.router?.push(href);
    const mainSectionKeys = [...standardMainFieldSections, ...fullWidthMainFieldSections].map((section: any) => String(section.key));

    return (
    <div className="flex-1 w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/*
        A real <form> element, purely so password inputs have a form ancestor: Chrome logs
        "[DOM] Password field is not contained in a form" for every one otherwise, and password
        managers misbehave. Saving is driven by the header/footer buttons, so submission is
        prevented here — Enter in a text field previously did nothing and still does nothing.
        <form> is block-level like the <div> it replaces, so layout is unaffected.
      */}
      <form onSubmit={(event) => event.preventDefault()}>
        {status && (
          <div className={`mb-8 p-4 rounded-xl flex items-start gap-4 border animate-in slide-in-from-top-2 ${status.type === NotificationType.SUCCESS ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
            <div className={`p-2 rounded-xl ${status.type === NotificationType.SUCCESS ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}>
              {status.type === NotificationType.SUCCESS ? <FrameworkIcons.Check size={20} /> : <FrameworkIcons.Alert size={20} />}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{AdminI18n.t(status.type === NotificationType.SUCCESS ? 'common.success' : 'common.error')}</p>
              <p className="text-sm opacity-90">{status.message}</p>
            </div>
            <button onClick={() => setStatus(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <FrameworkIcons.Close size={18} />
            </button>
          </div>
        )}



        {collection.admin?.tabs && collection.admin.tabs.length > 0 && (
          <div className={`flex items-center gap-2 mb-8 p-1.5 ${AdminClass.SURFACE} w-fit ${theme === ThemeMode.DARK ? 'bg-slate-900 border border-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
            {collection.admin.tabs.map((tab: any) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${
                  activeTab === tab.name
                    ? (theme === ThemeMode.DARK ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white text-indigo-600 shadow-sm')
                    : (theme === ThemeMode.DARK ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="min-w-0">
        {this.advancedView ? (
          <div className="pb-32">
            <RecordJsonView
              formData={formData}
              setFormData={setFormData}
              collectionSlug={resolvedSlug || slug}
              renderedFieldNames={[
                ...standardMainFieldSections,
                ...fullWidthMainFieldSections,
                ...sidebarFieldSections,
              ].flatMap((section: any) => (section?.fields || []).map((field: any) => String(field?.name || '')))}
            />
          </div>
        ) : (
        <>
          {/* The columns follow the width the form actually has, not the window's: with the menu and a
              plugin's sub-menu open, a 1280px window leaves the form about 700px, and a sidebar taking a
              third of that squeezed every field into a sliver. Below the width a sidebar fits beside the
              form, it moves under it. */}
          <div className="fc-edit-columns">
          <div className={`fc-edit-columns__grid ${renderSidebar ? 'fc-edit-columns__grid--sidebar' : ''}`}>
          <div className="min-w-0 space-y-6">
            <EditPageMain
              standardMainFieldSections={standardMainFieldSections}
              fullWidthMainFieldSections={fullWidthMainFieldSections}
              theme={theme}
              resolvedSlug={resolvedSlug}
              formData={formData}
              pluginSettings={pluginSettings}
              pluginSettingsSchema={pluginSettingsSchema}
              fieldErrors={fieldErrors}
              saving={saving}
              isNew={isNew}
              slugWarning={slugWarning}
              slugManuallyEdited={slugManuallyEdited}
              readOnlyOverrideGranted={readOnlyOverrideGranted}
              handleInputChange={handleInputChange}
              handlePatch={handlePatch}
              handleReadOnlyOverrideRequest={handleReadOnlyOverrideRequest}
              recordLinks={recordLinks}
              navigate={navigate}
              handleSubmit={() => handleSubmit()}
              saveError={status?.type === NotificationType.ERROR ? status.message : ''}
              recordTitle={edit.resolvedTitleValue}
              clearSaveError={() => setStatus(null)}
            />
            <EditRecordMoreCard sections={edit.moreSections} recordHref={this.recordHref} />
            {/* What is linked to this record and has no section of its own on this page. */}
            {recordLinks && (
              <CollectionRecordLinksPanel links={recordLinks} placedTerms={recordLinks.placedTerms(mainSectionKeys)} theme={theme} navigate={navigate} />
            )}
            {!renderSidebar && <div className="fc-edit-top"><div className="fc-edit-top__grid"><Slot name={`admin.collection.${slug}.edit.top`} props={{ formData, setFormData, isNew, handleSubmit, saving }} /></div></div>}
          </div>

          {renderSidebar && (
            <EditStickyColumn>
            {/* What plugins add to the record sits BESIDE its own fields, and after them on a phone: above
                the form it stood between the header and the record the operator opened the page to read. */}
            <div className="fc-edit-top"><div className="fc-edit-top__grid"><Slot name={`admin.collection.${slug}.edit.top`} props={{ formData, setFormData, isNew, handleSubmit, saving }} /></div></div>
            <EditPageSidebar
              slug={slug}
              id={id}
              isNew={isNew}
              theme={theme}
              collection={collection}
              resolvedSlug={resolvedSlug}
              formData={formData}
              setFormData={setFormData}
              handleSubmit={handleSubmit}
              saving={saving}
              pluginSettings={pluginSettings}
              pluginSettingsSchema={pluginSettingsSchema}
              fieldErrors={fieldErrors}
              handleInputChange={handleInputChange}
              handlePatch={handlePatch}
              handleReadOnlyOverrideRequest={handleReadOnlyOverrideRequest}
              readOnlyOverrideGranted={readOnlyOverrideGranted}
              showPermalink={showPermalink}
              hasDisablePermalink={hasDisablePermalink}
              hasSidebarFields={hasSidebarFields}
              sidebarFieldSections={sidebarFieldSections}
              hasBuiltInSidebarContent={hasBuiltInSidebarContent}
              revisions={revisions}
              revisionsLoading={revisionsLoading}
              activeVersionId={activeVersionId}
              setSelectedRevision={setSelectedRevision}
              setActiveVersionId={setActiveVersionId}
              loadMoreRevisions={loadMoreRevisions}
              hasMoreRevisions={hasMoreRevisions}
              saveError={status?.type === NotificationType.ERROR ? status.message : ''}
              recordTitle={edit.resolvedTitleValue}
              clearSaveError={() => setStatus(null)}
            />
            </EditStickyColumn>
          )}
          </div>
          </div>
        </>
        )}
        </div>

        <Slot name={`admin.collection.${slug}.edit.bottom`} props={{ formData, setFormData, isNew, handleSubmit, saving }} />

      </form>
    </div>
    );
  }
}
