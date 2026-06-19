import React from 'react';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { EditPageSectionNav } from './edit-page-section-nav';
import { EditPageMain } from './edit-page-main';
import { EditPageSidebar } from './edit-page-sidebar';
import type { EditPageBodyProps } from './edit-page-body.interfaces';

export class EditPageBody extends React.Component<EditPageBodyProps> {
  render(): React.ReactNode {
    const { edit, slug, id } = this.props;
    const {
      status, setStatus, formData, setFormData, isNew, handleSubmit, saving, collection, theme,
      activeTab, setActiveTab, navSections, renderSidebar, resolvedSlug, pluginSettings, fieldErrors,
      slugWarning, slugManuallyEdited, readOnlyOverrideFields, handleInputChange, handlePatch,
      handleReadOnlyOverrideRequest, standardMainFieldSections, fullWidthMainFieldSections,
      showPermalink, hasDisablePermalink, hasSidebarFields, sidebarFieldSections, hasBuiltInSidebarContent,
      revisions, revisionsLoading, activeVersionId, setSelectedRevision, setActiveVersionId,
      loadMoreRevisions, hasMoreRevisions
    } = edit;

    return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto">
        {status && (
          <div className={`mb-8 p-4 rounded-2xl flex items-start gap-4 border animate-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
            <div className={`p-2 rounded-xl ${status.type === 'success' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}>
              {status.type === 'success' ? <FrameworkIcons.Check size={20} /> : <FrameworkIcons.Alert size={20} />}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{status.type === 'success' ? 'Success' : 'Error'}</p>
              <p className="text-sm opacity-90">{status.message}</p>
            </div>
            <button onClick={() => setStatus(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <FrameworkIcons.Close size={18} />
            </button>
          </div>
        )}

        <Slot name={`admin.collection.${slug}.edit.top`} props={{ formData, setFormData, isNew, handleSubmit, saving }} />

        {collection.admin?.tabs && collection.admin.tabs.length > 0 && (
          <div className={`flex items-center gap-2 mb-8 p-1.5 rounded-2xl w-fit ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
            {collection.admin.tabs.map((tab: any) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${
                  activeTab === tab.name
                    ? (theme === 'dark' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white text-indigo-600 shadow-sm')
                    : (theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-start gap-3">
          <EditPageSectionNav sections={navSections} theme={theme} />
          <div className={`flex-1 grid grid-cols-1 ${renderSidebar ? 'lg:grid-cols-3' : ''} gap-8 pb-32`}>
          <div className={`${renderSidebar ? 'lg:col-span-2' : 'lg:col-span-1'} space-y-6`}>
            <EditPageMain
              standardMainFieldSections={standardMainFieldSections}
              fullWidthMainFieldSections={fullWidthMainFieldSections}
              theme={theme}
              resolvedSlug={resolvedSlug}
              formData={formData}
              pluginSettings={pluginSettings}
              fieldErrors={fieldErrors}
              saving={saving}
              isNew={isNew}
              slugWarning={slugWarning}
              slugManuallyEdited={slugManuallyEdited}
              readOnlyOverrideFields={readOnlyOverrideFields}
              handleInputChange={handleInputChange}
              handlePatch={handlePatch}
              handleReadOnlyOverrideRequest={handleReadOnlyOverrideRequest}
            />
          </div>

          {renderSidebar && (
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
              fieldErrors={fieldErrors}
              handleInputChange={handleInputChange}
              handlePatch={handlePatch}
              handleReadOnlyOverrideRequest={handleReadOnlyOverrideRequest}
              readOnlyOverrideFields={readOnlyOverrideFields}
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
            />
          )}
          </div>
        </div>

        <Slot name={`admin.collection.${slug}.edit.bottom`} props={{ formData, setFormData, isNew, handleSubmit, saving }} />
      </div>
    </div>
    );
  }
}
