import type { ReactElement } from 'react';
import { FieldRendererUtils } from '@/components/collection/field-renderer-utils';
import { FieldRendererHeader } from '@/components/collection/field-renderer-header';
import { FieldControlRenderer } from '@/components/collection/field-control-renderer';
import { FieldRendererFooter } from '@/components/collection/field-renderer-footer';
import { FieldRendererViewLocale } from '@/components/collection/field-renderer-view-locale';

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
    return this.isFieldReadOnly && textual && !this.isLocalizedField;
  }

  render(): ReactElement {
    const fieldComponents = (this.plugins as any).fieldComponents || {};
    const isLocalizedField = this.isLocalizedField;
    const defaultLocale = this.defaultLocale;
    const currentValue = this.currentValue;
    const label = this.label;

    const resolvedCurrentText = FieldRendererUtils.resolveRenderableText(currentValue, this.activeLocale || defaultLocale);
    const resolvedFieldDescription = FieldRendererUtils.resolveRenderableText(this.field.admin?.description, this.activeLocale || defaultLocale);

    return (
      <div className={FieldRendererUtils.wrapperClassName(this.field)}>
        <FieldRendererHeader
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
          resolvedFieldDescription={this.showsProvenanceInline ? '' : resolvedFieldDescription}
          errors={this.errors}
          provenance={this.provenance}
        />
      </div>
    );
  }
}
