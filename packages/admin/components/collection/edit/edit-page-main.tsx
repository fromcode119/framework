import React from 'react';
import { Card } from '@/components/ui/card';
import { FieldRenderer } from '@/components/collection/field-renderer';
import type { EditPageMainProps } from './edit-page-main.interfaces';

export class EditPageMain extends React.Component<EditPageMainProps> {
  render(): React.ReactNode {
    const {
      standardMainFieldSections, fullWidthMainFieldSections, theme, resolvedSlug, formData,
      pluginSettings, fieldErrors, saving, isNew, slugWarning, slugManuallyEdited,
      readOnlyOverrideFields, handleInputChange, handlePatch, handleReadOnlyOverrideRequest
    } = this.props;

    const renderField = (field: any) => (
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
        slugWarning={field.name === 'slug' ? slugWarning : undefined}
        slugManuallyEdited={field.name === 'slug' ? slugManuallyEdited : undefined}
        readOnlyOverrideGranted={Boolean(readOnlyOverrideFields[field.name])}
        onReadOnlyOverrideRequest={handleReadOnlyOverrideRequest}
      />
    );

    return (
      <>
        {standardMainFieldSections.map((section) => (
          <Card key={section.key} id={`section-${section.key}`} title={section.title}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
              {section.fields.map(renderField)}
            </div>
          </Card>
        ))}
        {fullWidthMainFieldSections.map((section) => (
          <Card key={`full-width-${section.key}`} id={`section-${section.key}`} title={section.title}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
              {section.fields.map(renderField)}
            </div>
          </Card>
        ))}
      </>
    );
  }
}
