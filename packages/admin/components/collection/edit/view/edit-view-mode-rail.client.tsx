import type { ReactNode } from 'react';
import { Reactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The Form / JSON view switch.
 *
 * It lives in its OWN rail rather than in the edit header or footer on purpose: both of those rows are
 * plugin extension points (`admin.collection.edit.header.actions`, the per-collection variants, the
 * footer bar), so what sits there changes from collection to collection and from plugin to plugin. A
 * core view-mode switch must not compete for space with actions it does not control, and must not move
 * around depending on which plugins are installed.
 *
 * So: a fixed, always-present rail that holds this control and nothing else — no slots, ever. Icon-only,
 * because it is two mutually exclusive modes and the pill spelled out FORM/JSON cost ~120px of the
 * header row for a control most editors touch rarely.
 *
 * Rendered OUTSIDE the form/JSON branch so it is present in both modes — the way back from JSON has to
 * be in the same place as the way in. It is also independent of `EditPageSectionNav`, which disappears
 * on collections that declare no sections.
 */
export class EditViewModeRail extends Reactor {
  @prop declare advancedView: boolean;
  @prop declare setAdvancedView: (next: boolean) => void;

  @bound private showForm(): void {
    this.setAdvancedView(false);
  }

  @bound private showJson(): void {
    this.setAdvancedView(true);
  }

  private buttonClass(active: boolean): string {
    const base = 'h-8 w-8 inline-flex items-center justify-center rounded-[var(--radius)] transition-colors';
    return active
      ? `${base} bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100`
      : `${base} text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300`;
  }

  render(): ReactNode {
    const { advancedView } = this;

    // Shown at every breakpoint — "always there" includes mobile, where hiding it would leave no way back
    // out of JSON view. On a wide screen it is a 40px column beside the form; on a narrow one a small
    // two-button switch above it, because a column there took a sixth of a phone's width down the whole page.
    return (
      <div
        className="z-10 flex shrink-0 flex-row gap-1 self-start rounded-[var(--radius)] border border-slate-200 bg-slate-50 p-1 lg:sticky lg:top-32 lg:flex-col dark:border-slate-800 dark:bg-slate-950"
        role="group"
        aria-label={AdminI18n.t('collection.edit.viewMode')}
      >
        <button
          type="button"
          onClick={this.showForm}
          className={this.buttonClass(!advancedView)}
          title={AdminI18n.t('collection.edit.formView')}
          aria-label={AdminI18n.t('collection.edit.formView')}
          aria-pressed={!advancedView}
        >
          <FrameworkIcons.List size={15} />
        </button>
        <button
          type="button"
          onClick={this.showJson}
          className={this.buttonClass(advancedView)}
          title={AdminI18n.t('collection.edit.jsonView')}
          aria-label={AdminI18n.t('collection.edit.jsonView')}
          aria-pressed={advancedView}
        >
          <FrameworkIcons.Code size={15} />
        </button>
      </div>
    );
  }
}
