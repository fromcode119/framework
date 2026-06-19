import React from 'react';
import { UiFieldUtils } from '@/lib/ui';
import type { FieldRendererFooterProps } from './field-renderer.interfaces';

export class FieldRendererFooter extends React.Component<FieldRendererFooterProps> {
  render(): React.ReactNode {
    const { field, resolvedFieldDescription, errors } = this.props;
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
