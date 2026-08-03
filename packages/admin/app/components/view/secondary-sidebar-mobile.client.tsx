import type { KeyboardEvent, ReactNode } from 'react';
import { PureReactor, prop, bound, Ref } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import type { ISecondaryPanelItem } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SecondarySidebarPanelBody } from '@/app/components/view/secondary-sidebar-panel-body.client';
import { SecondarySidebarMode } from '@/app/services/enums/secondary-sidebar-mode.enum';
import { AdminClass } from '@/lib/admin-class';
export class SecondarySidebarMobile extends PureReactor {
  @prop declare items: ISecondaryPanelItem[];
  @prop declare sourceLabel: string;
  @prop declare pathname: string;
  @prop declare mode: SecondarySidebarMode;
  @prop declare isOpen: boolean;
  @prop declare liveMessage: string;
  @prop declare dialogRef: Ref<HTMLDivElement>;
  @prop declare triggerRef: Ref<HTMLButtonElement>;
  @prop declare onOpen: () => void;
  @prop declare onClose: () => void;
  @prop declare onItemActivate?: (item?: ISecondaryPanelItem) => void;
  @prop declare onOverlayKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  @prop declare onListKeyDown: (event: KeyboardEvent<HTMLElement>) => void;

  @bound
  private handleItemActivate(item?: ISecondaryPanelItem): void {
    this.onItemActivate?.(item);
    this.onClose();
  }

  render(): ReactNode {
    return (
    <>
      <button
        ref={this.triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={this.isOpen}
        aria-controls={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
        onClick={this.onOpen}
        className={`fixed z-[170] ${AdminClass.SURFACE} text-slate-700 dark:text-slate-200 hover:border-indigo-400/70 transition-colors ${this.mode === SecondarySidebarMode.MOBILE ? 'bottom-6 right-6 h-12 w-12' : 'bottom-6 left-[84px] h-10 w-10'}`}
      >
        <FrameworkIcons.Right size={18} />
      </button>

      {this.isOpen && (
        <div className="fixed inset-0 z-[180]">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={this.onClose} />
          <div
            ref={this.dialogRef}
            id={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
            role="dialog"
            aria-modal="true"
            aria-label="Secondary navigation"
            className={`absolute top-0 bottom-0 w-[var(--secondary-sidebar-width)] overflow-hidden bg-white shadow-2xl dark:bg-[#020617] flex ${this.mode === SecondarySidebarMode.MOBILE ? 'right-0' : 'left-[72px] shadow-[-18px_0_36px_-28px_rgba(79,70,229,0.26),-10px_0_24px_-24px_rgba(15,23,42,0.22)] dark:shadow-[-18px_0_36px_-28px_rgba(99,102,241,0.18),-10px_0_24px_-24px_rgba(2,6,23,0.88)]'}`}
            onKeyDown={this.onOverlayKeyDown}
          >
            <div className="flex min-w-0 flex-1 flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-[#020617]">
              <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Secondary Navigation</h2>
              <button
                type="button"
                onClick={this.onClose}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close secondary navigation"
              >
                <FrameworkIcons.Close size={16} />
              </button>
            </div>

            <SecondarySidebarPanelBody
              items={this.items}
              sourceLabel={this.sourceLabel}
              pathname={this.pathname}
              onListKeyDown={this.onListKeyDown}
              onItemActivate={this.handleItemActivate}
            />
            </div>
          </div>
        </div>
      )}

      <span className="sr-only" aria-live="polite">{this.liveMessage}</span>
    </>
    );
  }
}
