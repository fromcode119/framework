import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Opens and closes a field's explanation.
 *
 * A description is written for the first time someone meets a field and was printed on every visit
 * after it, so a form's explanations outweighed its values. The sentence is still one press away, by
 * mouse, keyboard or finger — a hover-only hint would not exist on a phone.
 */
export class FieldHelpButton extends PureReactor {
  @prop declare label: string;
  @prop declare open: boolean;
  @prop declare onToggle: () => void;

  render(): ReactNode {
    return (
      <button
        type="button"
        onClick={this.onToggle}
        aria-expanded={this.open}
        aria-label={AdminI18n.t('ui.field.about', { label: this.label })}
        title={AdminI18n.t('ui.field.about', { label: this.label })}
        className={`relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full before:absolute before:-inset-1.5 before:content-[''] transition-colors ${
          this.open ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
        }`}
      >
        <FrameworkIcons.Info size={13} />
      </button>
    );
  }
}
