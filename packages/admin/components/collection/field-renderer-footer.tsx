import type React from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { UiFieldUtils } from '@/lib/ui';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';
import type { FieldProvenance } from '@/lib/collection/field-provenance';
import { FieldProvenanceKind } from '@/lib/collection/enums/field-provenance-kind.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class FieldRendererFooter extends PureReactor {
  @prop declare field: ICollectionField;
  @prop declare resolvedFieldDescription: string;
  @prop declare errors?: string[];
  @prop declare provenance?: FieldProvenance | null;
  @prop declare localeFallback?: { locale: string; text: string } | null;
  @prop declare activeLocale?: string;

  /** An empty localized box whose value the site takes from another locale — named, with that value. */
  private renderLocaleFallback(): React.ReactNode {
    const fallback = this.localeFallback;
    if (!fallback) return null;
    return (
      <p className={UiFieldUtils.TEXT.PROVENANCE}>
        {`${AdminI18n.t('ui.field.localeFallback', { locale: String(this.activeLocale || '').toUpperCase(), fallback: fallback.locale.toUpperCase() })} `}
        <span className={UiFieldUtils.TEXT.PROVENANCE_VALUE}>{fallback.text}</span>
        {'.'}
      </p>
    );
  }

  /**
   * States what the storefront will actually use for an EMPTY field, and names the control that decides
   * it. Without this an empty box and a box inheriting a live plugin setting look identical, which is
   * how a product with blank lead-time fields came to advertise a 10–15 day delivery window.
   */
  private renderProvenance(): React.ReactNode {
    const p = this.provenance;
    if (!p || p.kind === FieldProvenanceKind.OWN) return null;

    if (p.kind === FieldProvenanceKind.NONE) {
      return p.emptyMeans ? <p className={UiFieldUtils.TEXT.PROVENANCE_NONE}>{AdminI18n.t('ui.field.emptyMeans', { meaning: p.emptyMeans })}</p> : null;
    }

    return (
      <p className={UiFieldUtils.TEXT.PROVENANCE}>
        {`${AdminI18n.t('ui.field.emptyUses')} `}
        <span className={UiFieldUtils.TEXT.PROVENANCE_VALUE}>{p.effectiveValue}</span>
        {` ${AdminI18n.t('ui.field.from')} `}
        <a className={UiFieldUtils.TEXT.PROVENANCE_LINK} href={p.settingsHref}>
          {p.settingsTab ? `${AdminI18n.t('ui.field.pluginSettings')} → ${p.settingsTab}` : AdminI18n.t('ui.field.pluginSettings')}
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
        {this.renderLocaleFallback()}
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
