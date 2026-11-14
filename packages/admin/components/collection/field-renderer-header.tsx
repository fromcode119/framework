import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { UiFieldUtils } from '@/lib/ui';
import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { FieldLockControl } from '@/components/collection/view/field-lock-control.client';

export class FieldRendererHeader extends PureReactor {
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
  @prop declare localeSwitcher: (compact?: boolean) => ReactNode;
  /** The control that opens this field's explanation, when it is not already printed below. */
  @prop declare help?: ReactNode;

  render(): ReactNode {
    const {
      field, label, theme, isFieldReadOnly, supportsReadOnlyOverride, readOnlyOverrideGranted,
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
        <span className="flex min-w-0 items-center gap-1">
        <label className={UiFieldUtils.TEXT.LABEL}>
          {label}
          {field.required && <span className="text-rose-500 ms-1 font-semibold font-sans">*</span>}
        </label>
        {this.help}
        </span>
        )}

        <div className="flex items-center gap-2">
          {!isFieldReadOnly && supportsReadOnlyOverride && readOnlyOverrideGranted && (
            <span
              className={`inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[10px] font-semibold tracking-wide border ${
                theme === ThemeMode.DARK
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}
            >
              <FrameworkIcons.Check size={10} />
              {AdminI18n.t('ui.field.overrideUnlocked')}
            </span>
          )}
          {isFieldReadOnly && <FieldLockControl label={label} canUnlock={canRequestReadOnlyOverride} onUnlock={onRequestReadOnlyOverride} />}
          {isLocalizedField && !componentHandlesLocalization && !shouldInlineLocaleSwitcher && localeSwitcher(false)}
        </div>
      </div>
    );
  }
}
