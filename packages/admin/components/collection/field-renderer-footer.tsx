import type React from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { UiFieldUtils } from '@/lib/ui';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';
import type { FieldProvenance } from '@/lib/collection/field-provenance';

export class FieldRendererFooter extends PureReactor {
  @prop declare field: ICollectionField;
  @prop declare resolvedFieldDescription: string;
  @prop declare errors?: string[];
  @prop declare provenance?: FieldProvenance | null;

  /**
   * States what the storefront will actually use for an EMPTY field, and names the control that decides
   * it. Without this an empty box and a box inheriting a live plugin setting look identical, which is
   * how a product with blank lead-time fields came to advertise a 10–15 day delivery window.
   */
  private renderProvenance(): React.ReactNode {
    const p = this.provenance;
    if (!p || p.kind === 'own') return null;

    if (p.kind === 'none') {
      return p.emptyMeans ? <p className={UiFieldUtils.TEXT.PROVENANCE_NONE}>Empty — {p.emptyMeans}</p> : null;
    }

    return (
      <p className={UiFieldUtils.TEXT.PROVENANCE}>
        {'Empty — the site uses '}
        <span className={UiFieldUtils.TEXT.PROVENANCE_VALUE}>{p.effectiveValue}</span>
        {' from '}
        <a className={UiFieldUtils.TEXT.PROVENANCE_LINK} href={p.settingsHref}>
          {p.settingsTab ? `Plugin settings → ${p.settingsTab}` : 'Plugin settings'}
        </a>
        {` → “${p.settingLabel}”.`}
      </p>
    );
  }

  render(): React.ReactNode {
    const { field, resolvedFieldDescription, errors } = this;
    return (
      <>
        {resolvedFieldDescription && (
          <p className={UiFieldUtils.TEXT.SUBTEXT}>{resolvedFieldDescription}</p>
        )}
        {this.renderProvenance()}
        {errors && errors.length > 0 && (
          // Only show outer error text for types whose renderers don't display it internally.
          // Input (text/number/password) and TextArea already render the error inside themselves.
          field.admin?.component ||
          field.type === 'select' ||
          field.type === 'checkbox' ||
          field.type === 'date' ||
          field.type === 'array' ||
          field.type === 'json' ||
          field.type === 'relationship'
        ) && (
          <p className={UiFieldUtils.TEXT.ERROR}>{errors[0]}</p>
        )}
      </>
    );
  }
}
