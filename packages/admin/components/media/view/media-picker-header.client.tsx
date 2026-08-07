import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { X } from 'lucide-react';
import { AdminTypography } from '@/lib/typography';

/**
 * Title, source tabs and close. The Uploads/Theme tabs live here rather than behind a separate
 * button in each field, so "pick a picture" stays one job with one control.
 */
export class MediaPickerHeader extends PureReactor {
  @prop declare showSourceTabs: boolean;
  @prop declare themeSource: boolean;
  @prop declare onSourceChange: (themeSource: boolean) => void;
  @prop declare onClose: () => void;

  @bound private selectUploads(): void {
    this.onSourceChange(false);
  }

  @bound private selectTheme(): void {
    this.onSourceChange(true);
  }

  private tabClass(active: boolean): string {
    return `px-3 h-8 rounded-md text-[11px] font-semibold transition-colors ${
      active
        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
    }`;
  }

  private renderTabs(): ReactNode {
    if (!this.showSourceTabs) return null;

    return (
      <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/60">
        <button type="button" onClick={this.selectUploads} className={this.tabClass(!this.themeSource)}>
          Uploads
        </button>
        <button type="button" onClick={this.selectTheme} className={this.tabClass(this.themeSource)}>
          Theme
        </button>
      </div>
    );
  }

  render(): ReactNode {
    return (
      <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-6">
        <div>
          <h2 className={`${AdminTypography.TYPOGRAPHY.HEADING.SUBTLE} text-slate-900 dark:text-white`}>Media Library</h2>
          <p className={AdminTypography.TYPOGRAPHY.SUBTEXT}>Select or upload an asset to your project</p>
        </div>
        <div className="flex items-center gap-4">
          {this.renderTabs()}
          <button
            type="button"
            onClick={this.onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    );
  }
}
