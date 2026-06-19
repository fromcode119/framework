import React from 'react';
import SecondarySidebarPanelBody from './secondary-sidebar-panel-body';
import type { SidebarMobileSecondaryPanelProps } from './sidebar-mobile-secondary-panel.interfaces';

export class SidebarMobileSecondaryPanel extends React.Component<SidebarMobileSecondaryPanelProps> {
  render(): React.ReactNode {
    const { inlineSecondaryContext, inlineSecondaryItems, inlineSecondarySourceLabel, pathname, onClose } = this.props;
    return (
      <div className="lg:hidden min-w-0 flex-1 flex flex-col bg-slate-50/90 dark:bg-[#0b1220]">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            More In {String(inlineSecondarySourceLabel || inlineSecondaryContext?.label || 'This Section').trim()}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
          <SecondarySidebarPanelBody
            context={inlineSecondaryContext || null}
            items={inlineSecondaryItems || []}
            sourceLabel={String(inlineSecondarySourceLabel || '')}
            pathname={pathname}
            onListKeyDown={() => undefined}
            onItemActivate={onClose}
          />
        </div>
      </div>
    );
  }
}
