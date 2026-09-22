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

  /**
   * Request the unlock for a NAMED field rather than this one.
   *
   * A component that merges several fields into one control (an order's amounts) is hosted by a field
   * that is itself editable — otherwise the host arrives `disabled` and freezes the editable parts. So
   * the host's own `canRequestReadOnlyOverride` is false, and routing its unlock through
   * `requestReadOnlyOverride` made the button a no-op that reported nothing.
   *
   * Naming the target is safe because the unlock is record-scoped and the SERVER is the authority on
   * which fields may be overridden: `CollectionFieldGuard.isReadOnlyOverrideable` still refuses a
   * field declared `readOnlyOverride: 'never'`, whatever the admin asks for.
   */
  @bound protected requestReadOnlyOverrideForField(target: { name: string; label: string }): void {
    if (this.disabled || !this.onReadOnlyOverrideRequest || !target?.name) return;
    this.onReadOnlyOverrideRequest(target);
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
