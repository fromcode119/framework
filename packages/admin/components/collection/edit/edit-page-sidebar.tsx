import React from 'react';
import { Slot } from '@fromcode119/react';
import { Card } from '@/components/ui/card';
import { PermalinkInput } from '@/components/ui/permalink-input';
import { FieldRenderer } from '@/components/collection/field-renderer';
import { RecordInfo } from '@/components/collection/record-info';
import { SidebarVersions } from './sidebar-versions';
import type { EditPageSidebarProps } from './edit-page-sidebar.interfaces';

export class EditPageSidebar extends React.Component<EditPageSidebarProps> {
  render(): React.ReactNode {
    const {
      slug, id, isNew, theme, collection, resolvedSlug, formData, setFormData, handleSubmit, saving,
      pluginSettings, fieldErrors, handleInputChange, handlePatch, handleReadOnlyOverrideRequest,
      readOnlyOverrideFields, showPermalink, hasDisablePermalink, hasSidebarFields, sidebarFieldSections,
      hasBuiltInSidebarContent, revisions, revisionsLoading, activeVersionId, setSelectedRevision,
      setActiveVersionId, loadMoreRevisions, hasMoreRevisions
    } = this.props;
    return (
      <div className="lg:col-span-1 space-y-6">
        <Slot name={`admin.collection.${slug}.edit.sidebar`} props={{ formData, setFormData, isNew, handleSubmit, saving }} />
        <Slot name="admin.collection.edit.sidebar" props={{ formData, setFormData, isNew, handleSubmit, saving }} />

        {showPermalink && (
          <Card title="Preview & Permalink">
            <PermalinkInput
              value={formData.customPermalink}
              onChange={(val) => handleInputChange('customPermalink', val)}
              disabled={saving}
              id={isNew ? undefined : id}
              slug={formData.slug}
              collection={collection}
              pluginSettings={pluginSettings}
            />
            {hasDisablePermalink && (
              <button
                type="button"
                role="checkbox"
                aria-checked={Boolean(formData.disablePermalink)}
                onClick={() => !saving && handleInputChange('disablePermalink', !formData.disablePermalink)}
                disabled={saving}
                className={`flex items-center gap-2.5 mt-4 w-full text-left select-none text-[12px] font-semibold transition-colors ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}
              >
                <div className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${Boolean(formData.disablePermalink) ? 'bg-rose-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${Boolean(formData.disablePermalink) ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </div>
                Disable public URL
              </button>
            )}
            <p className="mt-3 text-[11px] text-slate-400 font-medium leading-relaxed">
              Click the path component to override the automatically generated slug.
            </p>
          </Card>
        )}

        {hasSidebarFields &&
          sidebarFieldSections.map((section) => (
            <Card key={`sidebar-section-${section.title}`} title={section.title}>
              <div className="space-y-6">
                {section.fields.map((field) => (
                  <FieldRenderer
                    key={field.name}
                    field={field}
                    value={formData[field.name]}
                    onChange={(val) => handleInputChange(field.name, val)}
                    record={formData}
                    onPatch={handlePatch}
                    theme={theme}
                    collectionSlug={resolvedSlug}
                    pluginSettings={pluginSettings}
                    disabled={saving}
                    isNew={isNew}
                    errors={fieldErrors[field.name]}
                    readOnlyOverrideGranted={Boolean(readOnlyOverrideFields[field.name])}
                    onReadOnlyOverrideRequest={handleReadOnlyOverrideRequest}
                  />
                ))}
              </div>
            </Card>
          ))}

        {!isNew && (
          <RecordInfo
            id={id}
            createdAt={formData.createdAt}
            updatedAt={formData.updatedAt}
          />
        )}

        {!isNew && (
          <SidebarVersions
            revisions={revisions}
            revisionsLoading={revisionsLoading}
            activeVersionId={activeVersionId}
            setSelectedRevision={setSelectedRevision}
            setFormData={setFormData}
            setActiveVersionId={setActiveVersionId}
            loadMoreRevisions={loadMoreRevisions}
            hasMoreRevisions={hasMoreRevisions}
            formData={formData}
          />
        )}

        {!hasBuiltInSidebarContent && (
          <Card title="Settings">
            <p className="text-sm text-slate-500 leading-relaxed">
              No sidebar fields are configured for this collection yet.
            </p>
          </Card>
        )}
      </div>
    );
  }
}
