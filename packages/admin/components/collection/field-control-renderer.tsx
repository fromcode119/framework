import React from 'react';
import { TextArea } from '@/components/ui/text-area';
import { BooleanToggleField } from '@/components/ui/boolean-toggle-field';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { ColorPicker } from '@/components/ui/color-picker';
import { CodeEditor } from '@/components/ui/code-editor';
import { LocalizedTextField } from './fields/localized-text-field';
import { ArrayField } from '@/components/ui/array-field';
import { Input } from '@/components/ui/input';
import { TagFieldLocal } from './tag-field-local';
import { RelationshipSelectLocal } from './relationship-select-local';
import { MediaRelationField } from './media-relation-field';
import { FieldRendererUtils } from './field-renderer-utils';
import { PermalinkField } from '@/components/ui/permalink-field';
import { FieldCustomComponent } from './field-custom-component';
import { FieldSelectControl } from './field-select-control';
import { FieldTextInput } from './field-text-input';
import { FieldTextualControl } from './field-textual-control';
import type { FieldControlRendererProps } from './field-renderer.interfaces';

export class FieldControlRenderer extends React.Component<FieldControlRendererProps> {
  render(): React.ReactNode {
    const {
      field,
      currentValue,
      resolvedCurrentText,
      updateValue,
      wrapWithReadOnlyOverride,
      theme,
      collectionSlug,
      pluginSettings,
      globalSettings,
      fieldComponents,
      isFieldReadOnly,
      isNew,
      errors,
      label,
      slugWarning,
      slugManuallyEdited,
      isLocalizedField,
      shouldInlineLocaleSwitcher,
      localeSwitcher,
      record,
      onPatch
    } = this.props;
    return (
      <>
      {field.type === 'relationship' && field.relationTo === 'media' ? (
        wrapWithReadOnlyOverride(
          <MediaRelationField value={currentValue} onChange={updateValue} theme={theme} hasMany={Boolean(field.hasMany)} />
        )
      ) : field.type === 'relationship' &&
        field.admin?.component !== 'TagField' &&
        field.admin?.component !== 'Tags' &&
        !field.hasMany ? (
        wrapWithReadOnlyOverride(
          <RelationshipSelectLocal
            field={field}
            value={currentValue}
            onChange={updateValue}
            theme={theme}
            record={record || {}}
            onPatch={onPatch || (() => {})}
          />
        )
      ) : field.type === 'relationship' || field.admin?.component === 'TagField' || field.admin?.component === 'Tags' ? (
        wrapWithReadOnlyOverride(
          <TagFieldLocal
            field={field}
            value={currentValue}
            onChange={updateValue}
            theme={theme}
            collectionSlug={collectionSlug}
          />
        )
      ) : field.admin?.component && field.admin?.component !== 'ColorPicker' && field.admin?.component !== 'CodeEditor' && field.admin?.component !== 'LocalizedText' && field.admin?.component !== 'LocalizedTextarea' ? (
        <FieldCustomComponent
          field={field}
          currentValue={currentValue}
          updateValue={updateValue}
          theme={theme}
          collectionSlug={collectionSlug}
          pluginSettings={pluginSettings}
          globalSettings={globalSettings}
          fieldComponents={fieldComponents}
          isFieldReadOnly={isFieldReadOnly}
          record={record}
          onPatch={onPatch}
          wrapWithReadOnlyOverride={wrapWithReadOnlyOverride}
        />
      ) : (field.type === 'textarea' || field.type === 'richText') ? (
        <FieldTextualControl
          kind="textarea"
          field={field}
          currentValue={currentValue}
          resolvedCurrentText={resolvedCurrentText}
          updateValue={updateValue}
          isFieldReadOnly={isFieldReadOnly}
          errors={errors}
          label={label}
          isLocalizedField={isLocalizedField}
          shouldInlineLocaleSwitcher={shouldInlineLocaleSwitcher}
          localeSwitcher={localeSwitcher}
          wrapWithReadOnlyOverride={wrapWithReadOnlyOverride}
        />
      ) : field.type === 'json' ? (
        <FieldTextualControl
          kind="json"
          field={field}
          currentValue={currentValue}
          resolvedCurrentText={resolvedCurrentText}
          updateValue={updateValue}
          isFieldReadOnly={isFieldReadOnly}
          errors={errors}
          label={label}
          isLocalizedField={isLocalizedField}
          shouldInlineLocaleSwitcher={shouldInlineLocaleSwitcher}
          localeSwitcher={localeSwitcher}
          wrapWithReadOnlyOverride={wrapWithReadOnlyOverride}
        />
      ) : field.type === 'array' ? (
        wrapWithReadOnlyOverride(
          <ArrayField
            field={field}
            value={currentValue}
            onChange={updateValue}
            theme={theme}
            collectionSlug={collectionSlug}
            pluginSettings={pluginSettings}
          globalSettings={globalSettings}
            fieldComponents={fieldComponents}
          />
        )
      ) : field.type === 'password' || (field.name === 'password' && isNew) ? (
        <FieldTextualControl
          kind="password"
          field={field}
          currentValue={currentValue}
          resolvedCurrentText={resolvedCurrentText}
          updateValue={updateValue}
          isFieldReadOnly={isFieldReadOnly}
          errors={errors}
          label={label}
          isLocalizedField={isLocalizedField}
          shouldInlineLocaleSwitcher={shouldInlineLocaleSwitcher}
          localeSwitcher={localeSwitcher}
          wrapWithReadOnlyOverride={wrapWithReadOnlyOverride}
        />
      ) : field.type === 'select' ? (
        <FieldSelectControl
          field={field}
          currentValue={currentValue}
          updateValue={updateValue}
          theme={theme}
          isFieldReadOnly={isFieldReadOnly}
          wrapWithReadOnlyOverride={wrapWithReadOnlyOverride}
        />
      ) : (field.type === 'boolean' || field.type === 'checkbox') ? (
        wrapWithReadOnlyOverride(
          <BooleanToggleField
            checked={FieldRendererUtils.toBooleanValue(currentValue, field.defaultValue)}
            onChange={(checked) => updateValue(checked)}
            disabled={isFieldReadOnly}
            theme={theme}
          />
        )
      ) : (field.type === 'date' || field.type === 'datetime') ? (
        wrapWithReadOnlyOverride(
          <DateTimePicker
            value={currentValue}
            onChange={updateValue}
            showTime={field.type === 'datetime'}
            disabled={isFieldReadOnly}
          />
        )
      ) : (field.type === 'color' || field.admin?.component === 'ColorPicker') ? (
        wrapWithReadOnlyOverride(
          <ColorPicker
            value={currentValue}
            onChange={updateValue}
            disabled={isFieldReadOnly}
          />
        )
      ) : (field.admin?.component === 'LocalizedText' || field.admin?.component === 'LocalizedTextarea') ? (
        wrapWithReadOnlyOverride(
          <LocalizedTextField
            value={currentValue}
            onChange={updateValue}
            disabled={isFieldReadOnly}
            multiline={field.admin?.component === 'LocalizedTextarea'}
            field={field}
          />
        )
      ) : (field.type === 'code' || field.admin?.component === 'CodeEditor') ? (
        wrapWithReadOnlyOverride(
          <CodeEditor
            value={currentValue}
            onChange={updateValue}
            language={field.admin?.language || 'javascript'}
            disabled={isFieldReadOnly}
          />
        )
      ) : field.type === 'permalink' ? (
        wrapWithReadOnlyOverride(
          <PermalinkField
            value={currentValue}
            onChange={updateValue}
            theme={theme}
            disabled={isFieldReadOnly}
          />
        )
      ) : (
        <FieldTextInput
          field={field}
          currentValue={currentValue}
          resolvedCurrentText={resolvedCurrentText}
          updateValue={updateValue}
          isFieldReadOnly={isFieldReadOnly}
          isNew={isNew}
          errors={errors}
          label={label}
          slugWarning={slugWarning}
          slugManuallyEdited={slugManuallyEdited}
          isLocalizedField={isLocalizedField}
          shouldInlineLocaleSwitcher={shouldInlineLocaleSwitcher}
          localeSwitcher={localeSwitcher}
          wrapWithReadOnlyOverride={wrapWithReadOnlyOverride}
        />
        )}
      </>
    );
  }
}
