import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { UiFieldUtils } from '@/lib/ui';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { FieldHelpButton } from '@/components/collection/view/field-help-button.client';
import { FieldLockControl } from '@/components/collection/view/field-lock-control.client';

/**
 * A value the operator may not edit, drawn as a FIELD: the same label row and the same box, at the same
 * height and in the same place as the editable field beside it.
 *
 * A read-only field keeps the structure and spacing of the enabled one and changes only what says
 * "not yours to type in": no shadow, a recessed fill, a lock where the cursor would go (Carbon,
 * read-only states). Drawn as bare text next to boxed inputs, a row of three fields read as two
 * captions and one field, in two sizes — the reader could not tell they were the same kind of thing.
 * Who writes the value is behind the help control; the lock unlocks the record.
 */
export class FieldLockedRow extends PureReactor {
  @prop declare label: string;
  @prop declare value: string;
  @prop declare description?: string;
  @prop declare hideLabel?: boolean;
  @prop declare helpOpen: boolean;
  @prop declare onToggleHelp: () => void;
  /** True when this operator may unlock the record's read-only fields. */
  @prop declare canUnlock: boolean;
  @prop declare onUnlock: () => void;
  /** The description as a line under the name, on a settings row — see `FieldSummary`. */
  @prop declare summary?: ReactNode;

  render(): ReactNode {
    const text = String(this.value ?? '').trim();
    const description = String(this.description || '').trim();
    return (
      <div className="fc-field-locked">
        {!this.hideLabel || description ? (
          <div className="fc-field-head mb-1 min-h-[22px]">
            <div className="flex min-w-0 items-center gap-1">
              {!this.hideLabel && <span className={`${UiFieldUtils.TEXT.LABEL} !mb-0`}>{this.label}</span>}
              {description && <FieldHelpButton label={this.label} open={this.helpOpen} onToggle={this.onToggleHelp} />}
            </div>
            {this.summary}
          </div>
        ) : null}
        <div className="flex min-h-10 items-center justify-between gap-2 rounded-[var(--radius)] border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900/60">
          <span className={`fc-field min-w-0 break-words leading-snug ${text ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
            {text || AdminI18n.t('ui.field.notSet')}
          </span>
          <FieldLockControl label={this.label} canUnlock={this.canUnlock} onUnlock={this.onUnlock} />
        </div>
        {this.helpOpen && description && !this.summary && <p className={UiFieldUtils.TEXT.SUBTEXT}>{description}</p>}
      </div>
    );
  }
}
