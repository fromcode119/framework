import type React from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { UiFieldUtils } from '@/lib/ui';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

export class FieldRendererFooter extends PureReactor {
  @prop declare field: ICollectionField;
  @prop declare resolvedFieldDescription: string;
  @prop declare errors?: string[];

  render(): React.ReactNode {
    const { field, resolvedFieldDescription, errors } = this;
    return (
      <>
        {resolvedFieldDescription && (
          <p className={UiFieldUtils.TEXT.SUBTEXT}>{resolvedFieldDescription}</p>
        )}
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
