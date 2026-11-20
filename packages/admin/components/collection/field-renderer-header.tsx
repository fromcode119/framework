import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { UiFieldUtils } from '@/lib/ui';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { FieldLockControl } from '@/components/collection/view/field-lock-control.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';

export class FieldRendererHeader extends PureReactor {
  private static readonly CONTROLS = 'input:not([type="hidden"]), textarea, select, button, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

  /**
   * Clicking a field's name focuses its control, as a label does in any form. The header and the control are
   * separate components, so the label cannot wrap or point at it by id: it finds the first control of its own
   * field, past the header's own buttons (lock, help, language).
   */
  static focusControl(event: { currentTarget: HTMLElement }): void {
    const head = event.currentTarget.closest('.fc-field-head');
    const controls = Array.from(head?.parentElement?.querySelectorAll<HTMLElement>(FieldRendererHeader.CONTROLS) ?? []);
    controls.find((control) => !head?.contains(control) && !control.hasAttribute('disabled'))?.focus();
  }

  @prop declare field: ICollectionField;
  @prop declare label: string;
  @prop declare theme: ThemeMode;
  @prop declare isFieldReadOnly: boolean;
  @prop declare supportsReadOnlyOverride: boolean;
  @prop declare readOnlyOverrideGranted: boolean;
  @prop declare canRequestReadOnlyOverride: boolean;
  @prop declare isLocalizedField: boolean;
  @prop declare componentHandlesLocalization: boolean;
  @prop declare shouldInlineLocaleSwitcher: boolean;
  @prop declare onRequestReadOnlyOverride: () => void;
  @prop declare localeSwitcher: () => ReactNode;
  /** The control that opens this field's explanation, when it is not already printed below. */
  @prop declare help?: ReactNode;
  /** The description as a line under the name, on a settings row — see `FieldSummary`. */
  @prop declare summary?: ReactNode;

  render(): ReactNode {
    const {
      field, label, isFieldReadOnly, supportsReadOnlyOverride, readOnlyOverrideGranted,
      canRequestReadOnlyOverride, isLocalizedField, componentHandlesLocalization,
      shouldInlineLocaleSwitcher, onRequestReadOnlyOverride, localeSwitcher
    } = this;
    // A field with its label hidden and nothing else to show here takes no row: an empty 22px header
    // left a gap above the control, which is the card's own title when the label is hidden for that.
    // The same holds for a locked field nobody can unlock: with no label beside it the lock is a lone
    // icon above the control, saying nothing and opening nothing.
    const lockIsUseful = isFieldReadOnly && canRequestReadOnlyOverride;
    if (field.admin?.hideLabel && !lockIsUseful && !isLocalizedField) return null;
    return (
      <div className="fc-field-head flex items-center justify-between gap-3 mb-1 min-h-[22px]">
        {!field.admin?.hideLabel && (
        <div className="min-w-0">
        <span className="flex min-w-0 items-center gap-1">
        <label className={UiFieldUtils.TEXT.LABEL} onClick={FieldRendererHeader.focusControl}>
          {label}
          {field.required && <span className="fc-tone-danger ms-1 font-medium font-sans">*</span>}
        </label>
        {this.help}
        </span>
        {this.summary}
        </div>
        )}

        <div className="flex items-center gap-2">
          {!isFieldReadOnly && supportsReadOnlyOverride && readOnlyOverrideGranted && (
            <Badge variant={BadgeVariant.SUCCESS}>
              <FrameworkIcons.Check size={10} />
              {AdminI18n.t('ui.field.overrideUnlocked')}
            </Badge>
          )}
          {isFieldReadOnly && <FieldLockControl label={label} canUnlock={canRequestReadOnlyOverride} onUnlock={onRequestReadOnlyOverride} />}
          {isLocalizedField && !componentHandlesLocalization && !shouldInlineLocaleSwitcher && localeSwitcher()}
        </div>
      </div>
    );
  }
}
