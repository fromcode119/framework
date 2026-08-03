import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

import { SecondarySidebarPanelBody } from '@/app/components/view/secondary-sidebar-panel-body.client';

export class SidebarMobileSecondaryPanel extends PureReactor {
  @prop declare inlineSecondaryContext?: any;
  @prop declare inlineSecondaryItems?: any[];
  @prop declare inlineSecondarySourceLabel?: string;
  @prop declare pathname: string;
  @prop declare onClose?: () => void;

  render(): ReactNode {
    return (
      <div className="lg:hidden min-w-0 flex-1 flex flex-col bg-slate-50/90 dark:bg-[#0b1220]">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            More In {String(this.inlineSecondarySourceLabel || this.inlineSecondaryContext?.label || 'This Section').trim()}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
          <SecondarySidebarPanelBody
            items={this.inlineSecondaryItems || []}
            sourceLabel={String(this.inlineSecondarySourceLabel || '')}
            pathname={this.pathname}
            onListKeyDown={() => undefined}
            onItemActivate={this.onClose}
          />
        </div>
      </div>
    );
  }
}
