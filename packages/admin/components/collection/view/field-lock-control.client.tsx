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
        <span role="img" aria-label={AdminI18n.t('ui.field.readOnly')} title={AdminI18n.t('ui.field.readOnly')} className="fc-btn fc-btn--glyph shrink-0 opacity-60">
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
        className="fc-btn fc-btn--glyph shrink-0"
      >
        <FrameworkIcons.Lock size={12} />
      </button>
    );
  }
}
