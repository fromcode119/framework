import type { ReactElement } from 'react';
import { FieldRendererUtils } from '@/components/collection/field-renderer-utils';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { FieldRendererHeader } from '@/components/collection/field-renderer-header';
import { FieldControlRenderer } from '@/components/collection/field-control-renderer';
import { FieldRendererFooter } from '@/components/collection/field-renderer-footer';
import { FieldRendererViewLocale } from '@/components/collection/field-renderer-view-locale';
import { FieldBooleanRow } from '@/components/collection/field-boolean-row';
import { FieldLockedRow } from '@/components/collection/view/field-locked-row.client';
import { FieldHelpButton } from '@/components/collection/view/field-help-button.client';
import { ReadOnlyFieldValue } from '@/components/collection/view/read-only-field-value.client';

/**
 * One field of a record, rendered by whichever component its type resolves to.
 *
 * The top of the chain: the lifecycle and the markup. What the field knows, whether it may be edited
 * and how it handles locales live in the links below — see `FieldRendererViewState`.
 */
export class FieldRendererView extends FieldRendererViewLocale {
  componentDidMount(): void {
    this.syncActiveLocale();
    this.syncOutsideClickListener();
  }

  componentWillUnmount(): void {
    if (this.outsideClickAttached) {
      document.removeEventListener('mousedown', this.onClickOutside);
      this.outsideClickAttached = false;
    }
  }

  /**
   * Whether the control itself already shows the description, as a read-only lock bar does.
   *
   * Printing it in both places puts the same sentence twice on one field, a few pixels apart. The
   * conditions mirror the two controls that render `ReadOnlyFieldValue`.
   */
  private get showsProvenanceInline(): boolean {
    const kind = String(this.field.type || '');
    const textual = ['text', 'number', 'textarea', 'richText', 'email', 'url'].includes(kind);
    // Selects, toggles and dates render through the same value display when locked, so their
    // description belongs in the bar too — otherwise it prints twice for those kinds only.
    const valued = ['select', 'boolean', 'checkbox', 'date', 'datetime'].includes(kind);
    return this.isFieldReadOnly && (textual || valued) && !this.isLocalizedField;
  }

  /**
   * An editable yes/no field with no control of its own: drawn as a tick box beside its label. A locked
   * one keeps the read-only value display and its unlock control, and a declared component keeps its own.
   */
  private get isPlainBoolean(): boolean {
    const kind = String(this.field.type || '');
    return (kind === 'boolean' || kind === 'checkbox') && !this.field.admin?.component && !this.isFieldReadOnly && !this.isLocalizedField;
  }

  /** A locked value with no control of its own, drawn as one row — see `FieldLockedRow`. */
  private get isLockedValue(): boolean {
    return this.showsProvenanceInline && !this.field.admin?.component && String(this.field.type) !== 'richText';
  }

  private lockedText(currentValue: unknown, resolvedCurrentText: string): string {
    const kind = String(this.field.type || '');
    if (['select', 'boolean', 'checkbox', 'date', 'datetime'].includes(kind)) return ReadOnlyFieldValue.describe(this.field, currentValue);
    if (kind === 'number') return typeof currentValue === 'number' || typeof currentValue === 'string' ? String(currentValue) : '';
    return typeof currentValue === 'string' ? currentValue : resolvedCurrentText;
  }

  /**
   * Whether the explanation is printed without being asked for: only when the field has no label row to
   * carry the help control. It used to print for every EMPTY field as well, which is every field of a
   * new record — sixteen paragraphs down a new product, before anything had been typed.
   */
  private alwaysPrintsDescription(): boolean {
    return Boolean(this.field.admin?.hideLabel);
  }

  render(): ReactElement {
    const fieldComponents = (this.plugins as any).fieldComponents || {};
    const isLocalizedField = this.isLocalizedField;
    const defaultLocale = this.defaultLocale;
    const currentValue = this.currentValue;
    const label = this.label;

    const resolvedCurrentText = FieldRendererUtils.resolveRenderableText(currentValue, this.activeLocale || defaultLocale);
    const ownDescription = this.field.extendedBy === 'system' ? AdminI18n.optional(`collection.systemFields.${this.field.name}.description`) : '';
    const resolvedFieldDescription = ownDescription || FieldRendererUtils.resolveRenderableText(this.field.admin?.description, this.activeLocale || defaultLocale);

    if (this.isPlainBoolean) {
      return (
        <div className={FieldRendererUtils.wrapperClassName(this.field)}>
          <FieldBooleanRow
            label={label}
            description={resolvedFieldDescription}
            checked={FieldRendererUtils.toBooleanValue(currentValue, this.field.defaultValue)}
            onChange={this.updateValue}
            required={Boolean(this.field.required)}
          />
          <FieldRendererFooter
            field={this.field}
            resolvedFieldDescription=""
            errors={this.errors}
            provenance={this.provenance}
            localeFallback={this.localeFallback}
            activeLocale={this.activeLocale}
          />
        </div>
      );
    }

    if (this.isLockedValue) {
      return (
        <div className={FieldRendererUtils.wrapperClassName(this.field)}>
          <FieldLockedRow
            label={label}
            value={this.lockedText(currentValue, resolvedCurrentText)}
            description={resolvedFieldDescription}
            hideLabel={Boolean(this.field.admin?.hideLabel)}
            helpOpen={this.helpOpen}
            onToggleHelp={this.toggleHelp}
            canUnlock={this.canRequestReadOnlyOverride}
            onUnlock={this.requestReadOnlyOverride}
          />
          <FieldRendererFooter field={this.field} resolvedFieldDescription="" errors={this.errors} provenance={this.provenance} localeFallback={this.localeFallback} activeLocale={this.activeLocale} />
        </div>
      );
    }

    const descriptionOnDemand = Boolean(resolvedFieldDescription) && !this.showsProvenanceInline && !this.alwaysPrintsDescription();
    return (
      <div className={FieldRendererUtils.wrapperClassName(this.field)}>
        <FieldRendererHeader
          help={descriptionOnDemand ? <FieldHelpButton label={label} open={this.helpOpen} onToggle={this.toggleHelp} /> : undefined}
          field={this.field}
          label={label}
          theme={this.theme}
          isFieldReadOnly={this.isFieldReadOnly}
          supportsReadOnlyOverride={this.supportsReadOnlyOverride}
          readOnlyOverrideGranted={this.readOnlyOverrideGranted ?? false}
          canRequestReadOnlyOverride={this.canRequestReadOnlyOverride}
          isLocalizedField={isLocalizedField}
          componentHandlesLocalization={this.componentHandlesLocalization}
          shouldInlineLocaleSwitcher={this.shouldInlineLocaleSwitcher}
          onRequestReadOnlyOverride={this.requestReadOnlyOverride}
          localeSwitcher={this.localeSwitcherProp}
        />

        <FieldControlRenderer
          field={this.field}
          currentValue={currentValue}
          resolvedCurrentText={resolvedCurrentText}
          updateValue={this.updateValue}
          resolvedFieldDescription={resolvedFieldDescription}
          wrapWithReadOnlyOverride={this.wrapWithReadOnlyOverride}
          theme={this.theme}
          collectionSlug={this.collectionSlug}
          pluginSettings={this.pluginSettings}
          globalSettings={this.globalSettings}
          fieldComponents={fieldComponents}
          isFieldReadOnly={this.isFieldReadOnly}
          isNew={this.isNew ?? false}
          errors={this.errors}
          label={label}
          slugWarning={this.slugWarning}
          slugManuallyEdited={this.slugManuallyEdited}
          isLocalizedField={isLocalizedField}
          shouldInlineLocaleSwitcher={this.shouldInlineLocaleSwitcher}
          localeSwitcher={this.localeSwitcherProp}
          record={this.record}
          onPatch={this.onPatch}
          onRequestReadOnlyOverride={this.requestReadOnlyOverrideForField}
          readOnlyOverrideGranted={this.readOnlyOverrideGranted ?? false}
        />

        <FieldRendererFooter
          field={this.field}
          resolvedFieldDescription={this.showsProvenanceInline || (descriptionOnDemand && !this.helpOpen) ? '' : resolvedFieldDescription}
          errors={this.errors}
          provenance={this.provenance}
          localeFallback={this.localeFallback}
          activeLocale={this.activeLocale}
        />
      </div>
    );
  }
}
