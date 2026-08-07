import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';

export class EditPageMain extends PureReactor {
  @prop declare standardMainFieldSections: Array<{ key: string; title?: string; fields: any[] }>;
  @prop declare fullWidthMainFieldSections: Array<{ key: string; title?: string; fields: any[] }>;
  @prop declare theme: ThemeMode;
  @prop declare resolvedSlug: string;
  @prop declare formData: Record<string, any>;
  @prop declare pluginSettings: Record<string, any>;
  @prop declare pluginSettingsSchema: Record<string, any>;
  @prop declare fieldErrors: Record<string, any>;
  @prop declare saving: boolean;
  @prop declare isNew: boolean;
  @prop declare slugWarning?: string | null;
  @prop declare slugManuallyEdited?: boolean;
  @prop declare readOnlyOverrideFields: Record<string, true>;
  @prop declare handleInputChange: (name: string, value: any) => void;
  @prop declare handlePatch: (partial: Record<string, any>) => void;
  @prop declare handleReadOnlyOverrideRequest: (target: { name: string; label: string }) => void;

  @bound renderField(field: any): ReactNode {
    return (
      <FieldRenderer
        key={field.name}
        field={field}
        value={this.formData[field.name]}
        onChange={(val) => this.handleInputChange(field.name, val)}
        record={this.formData}
        onPatch={this.handlePatch}
        theme={this.theme}
        collectionSlug={this.resolvedSlug}
        pluginSettings={this.pluginSettings}
        pluginSettingsSchema={this.pluginSettingsSchema}
        disabled={this.saving}
        isNew={this.isNew}
        errors={this.fieldErrors[field.name]}
        slugWarning={field.name === 'slug' ? this.slugWarning : undefined}
        slugManuallyEdited={field.name === 'slug' ? this.slugManuallyEdited : undefined}
        readOnlyOverrideGranted={Boolean(this.readOnlyOverrideFields[field.name])}
        onReadOnlyOverrideRequest={this.handleReadOnlyOverrideRequest}
      />
    );
  }

  render(): ReactNode {
    return (
      <>
        {this.standardMainFieldSections.map((section) => (
          <Card key={section.key} id={`section-${section.key}`} title={section.title}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
              {section.fields.map(this.renderField)}
            </div>
          </Card>
        ))}
        {this.fullWidthMainFieldSections.map((section) => (
          <Card key={`full-width-${section.key}`} id={`section-${section.key}`} title={section.title}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
              {section.fields.map(this.renderField)}
            </div>
          </Card>
        ))}
      </>
    );
  }
}
