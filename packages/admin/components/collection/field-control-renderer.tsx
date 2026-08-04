import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';

import { BooleanToggleField } from '@/components/ui/view/boolean-toggle-field.client';
import { DateTimePicker } from '@/components/ui/date-time-picker/view/index.client';
import { ColorField } from '@/components/ui/view/color-field.client';
import { CodeEditor } from '@/components/ui/view/code-editor.client';
import { LocalizedTextField } from '@/components/collection/fields/view/localized-text-field.client';
import { ArrayField } from '@/components/ui/view/array-field.client';

import { TagFieldLocal } from '@/components/collection/view/tag-field-local.client';
import { RelationshipSelectLocal } from '@/components/collection/view/relationship-select-local.client';
import { MediaRelationField } from '@/components/collection/view/media-relation-field.client';
import { FieldRendererUtils } from '@/components/collection/field-renderer-utils';
import { PermalinkField } from '@/components/ui/view/permalink-field.client';
import { FieldCustomComponent } from '@/components/collection/field-custom-component';
import { FieldSelectControl } from '@/components/collection/field-select-control';
import { FieldTextInput } from '@/components/collection/field-text-input';
import { FieldTextualControl } from '@/components/collection/field-textual-control';
import { TextualFieldKind } from '@/components/collection/enums/textual-field-kind.enum';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

export class FieldControlRenderer extends PureReactor {
  @prop declare field: ICollectionField;
  @prop declare currentValue: any;
  @prop declare resolvedCurrentText: string;
  @prop declare updateValue: (value: any) => void;
  @prop declare wrapWithReadOnlyOverride: (node: ReactNode, roundedClass?: string) => ReactNode;
  @prop declare theme: ThemeMode;
  @prop declare collectionSlug: string;
  @prop declare pluginSettings?: Record<string, any>;
  @prop declare globalSettings?: Record<string, any>;
  @prop declare fieldComponents: Record<string, any>;
  @prop declare isFieldReadOnly: boolean;
  @prop declare isNew: boolean;
  @prop declare errors?: string[];
  @prop declare label: string;
  @prop declare slugWarning?: string | null;
  @prop declare slugManuallyEdited?: boolean;
  @prop declare isLocalizedField: boolean;
  @prop declare shouldInlineLocaleSwitcher: boolean;
  @prop declare localeSwitcher: (compact?: boolean) => ReactNode;
  @prop declare record?: Record<string, any>;
  @prop declare onPatch?: (partial: Record<string, any>) => void;

  render(): ReactNode {
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
    } = this;
    return (
      <>
      {/* A registered custom component wins over every built-in control (incl. the media
          relationship picker) — except the names below, which are aliases for built-ins
          handled by their own branches further down. */}
      {field.admin?.component &&
        field.admin?.component !== 'ColorPicker' && field.admin?.component !== 'ColorField' &&
        field.admin?.component !== 'CodeEditor' && field.admin?.component !== 'LocalizedText' &&
        field.admin?.component !== 'LocalizedTextarea' && field.admin?.component !== 'TagField' &&
        field.admin?.component !== 'Tags' ? (
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
      ) : field.type === 'relationship' && field.relationTo === 'media' ? (
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
            themeMode={theme}
            onPatch={onPatch || (() => {})}
          />
        )
      ) : field.type === 'relationship' || field.admin?.component === 'TagField' || field.admin?.component === 'Tags' ? (
        wrapWithReadOnlyOverride(
          <TagFieldLocal
            field={field}
            value={currentValue}
            onChange={updateValue}
            themeMode={theme}
            collectionSlug={collectionSlug}
          />
        )
      ) : (field.type === 'textarea' || field.type === 'richText') ? (
        <FieldTextualControl
          kind={TextualFieldKind.TEXTAREA}
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
          kind={TextualFieldKind.JSON}
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
          kind={TextualFieldKind.PASSWORD}
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
      ) : (field.type === 'color' || field.admin?.component === 'ColorPicker' || field.admin?.component === 'ColorField') ? (
        wrapWithReadOnlyOverride(
          <ColorField
            value={currentValue}
            onChange={updateValue}
            disabled={isFieldReadOnly}
            field={field}
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
