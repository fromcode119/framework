import type { ReactNode } from 'react';
import { FieldLevel } from '@fromcode119/core/client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * How much of the record the form shows: the everyday fields, those plus the occasional ones, or all.
 *
 * Each choice names how many fields it adds, so what the form is holding back is always stated. It is
 * not drawn at all for a collection whose fields declare no level — there is nothing to widen.
 */
export class EditFieldDepthSwitch extends PureReactor {
  @prop declare depth: FieldLevel;
  @prop declare counts: Record<string, number>;
  @prop declare onChange: (next: FieldLevel) => void;

  private get hasWiderLevels(): boolean {
    return FieldLevel.ordered.some((level) => level !== FieldLevel.EVERYDAY && (this.counts?.[level.value] || 0) > 0);
  }

  private buttonClass(active: boolean): string {
    const base = 'px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors';
    return active
      ? `${base} bg-indigo-600 text-white dark:bg-indigo-500`
      : `${base} text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200`;
  }

  private label(level: FieldLevel): string {
    const name = AdminI18n.t(`collection.edit.fieldLevel.${level.value}`);
    const added = this.counts?.[level.value] || 0;
    return level === FieldLevel.EVERYDAY || added === 0 ? name : AdminI18n.t('collection.edit.fieldLevel.adds', { name, count: added });
  }

  private renderOption(level: FieldLevel): ReactNode {
    const active = level === this.depth;
    return (
      <button key={level.value} type="button" aria-pressed={active} className={this.buttonClass(active)} onClick={() => this.onChange(level)}>
        {this.label(level)}
      </button>
    );
  }

  render(): ReactNode {
    if (!this.hasWiderLevels) return null;
    return (
      <div
        role="group"
        aria-label={AdminI18n.t('collection.edit.fieldLevel.label')}
        // No box of its own: framed like the cards under it, it read as one more card stacked on them.
        className="mb-3 flex max-w-full flex-wrap items-center gap-1 sm:mb-5"
      >
        <span className="sr-only pe-2 text-[12px] font-medium text-slate-500 sm:not-sr-only dark:text-slate-400">{AdminI18n.t('collection.edit.fieldLevel.label')}</span>
        {FieldLevel.ordered.filter((level) => level === FieldLevel.EVERYDAY || (this.counts?.[level.value] || 0) > 0).map((level) => this.renderOption(level))}
      </div>
    );
  }
}
