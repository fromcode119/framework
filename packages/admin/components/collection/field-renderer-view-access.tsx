import type { ReactNode } from 'react';
import { bound } from '@fromcode119/react-class-components';
import { FieldRendererViewState } from '@/components/collection/field-renderer-view-state';

/**
 * Whether this field may be edited, and how an operator asks to edit one that may not.
 *
 * A read-only field stays read-only until the override is GRANTED — the request is a deliberate act
 * with a visible control, never a silent unlock.
 */
export abstract class FieldRendererViewAccess extends FieldRendererViewState {
  protected get fieldMarkedReadOnly(): boolean {
    return Boolean(this.field.admin?.readOnly);
  }

  protected get readOnlyOverrideDisabled(): boolean {
    const { field } = this;
    return (
      field.admin?.readOnlyOverride === false ||
      field.admin?.readOnlyOverride === 'never' ||
      field.admin?.allowReadOnlyOverride === false
    );
  }

  protected get supportsReadOnlyOverride(): boolean {
    return this.fieldMarkedReadOnly && !this.readOnlyOverrideDisabled;
  }

  protected get isFieldReadOnly(): boolean {
    return Boolean(this.disabled || (this.fieldMarkedReadOnly && !this.readOnlyOverrideGranted));
  }

  protected get canRequestReadOnlyOverride(): boolean {
    return Boolean(!this.disabled && this.supportsReadOnlyOverride && this.isFieldReadOnly && this.onReadOnlyOverrideRequest);
  }

  @bound protected requestReadOnlyOverride(): void {
    if (!this.canRequestReadOnlyOverride || !this.onReadOnlyOverrideRequest) return;
    this.onReadOnlyOverrideRequest({ name: this.field.name, label: this.label });
  }

  @bound protected wrapWithReadOnlyOverride(node: ReactNode, roundedClass: string = 'rounded-lg'): ReactNode {
    if (!this.canRequestReadOnlyOverride) return node;
    return (
      <div className="relative">
        {node}
        <button
          type="button"
          onClick={this.requestReadOnlyOverride}
          className={`absolute inset-0 z-20 ${roundedClass} border border-indigo-400/50 bg-indigo-500/[0.03] hover:bg-indigo-500/[0.06] transition-colors`}
          title={`Override read-only field "${this.label}"`}
          aria-label={`Override read-only field ${this.label}`}
        />
      </div>
    );
  }
}
