import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The lock on a value the operator may not edit: a control when this operator may unlock the record's
 * read-only fields, a plain mark when nobody may.
 *
 * One drawing for every locked field. It used to be a lettered "Unlock edit" pill on some fields and a
 * "Read only" chip on others, each wider than most of the values it sat beside.
 */
export class FieldLockControl extends PureReactor {
  @prop declare label: string;
  @prop declare canUnlock: boolean;
  @prop declare onUnlock: () => void;

  render(): ReactNode {
    if (!this.canUnlock) {
      return (
        <span role="img" aria-label={AdminI18n.t('ui.field.readOnly')} title={AdminI18n.t('ui.field.readOnly')} className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-slate-300 dark:text-slate-600">
          <FrameworkIcons.Lock size={12} />
        </span>
      );
    }
    const title = AdminI18n.t('ui.field.unlockTitle', { label: this.label });
    return (
      <button
        type="button"
        onClick={this.onUnlock}
        title={title}
        aria-label={title}
        className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full before:absolute before:-inset-1.5 before:content-[''] text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-500 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-300"
      >
        <FrameworkIcons.Lock size={12} />
      </button>
    );
  }
}
