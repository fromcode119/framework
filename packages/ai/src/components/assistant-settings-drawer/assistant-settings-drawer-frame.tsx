import { DrawerPresentation } from '@ai/enums/drawer-presentation.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

export class AssistantSettingsDrawerFrame extends PureReactor {
  @prop declare isOpen: boolean;
  @prop declare presentation: DrawerPresentation;
  @prop declare onRequestClose: () => void;
  @prop declare children: ReactNode;

  render(): ReactNode {
    return (
      <>
        {this.presentation === DrawerPresentation.OVERLAY ? (
          <div
            className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
              this.isOpen ? 'animate-[fade-in_0.3s_ease-out]' : 'opacity-0 pointer-events-none'
            }`}
            onClick={this.onRequestClose}
            aria-hidden="true"
          />
        ) : null}
        <aside
          className={`flex h-full flex-col overflow-hidden bg-[var(--sidebar-bg)] ${
            this.presentation === DrawerPresentation.OVERLAY
              ? `fixed right-0 top-0 z-50 w-full max-w-md border-l border-[var(--border)] transition-transform duration-300 ease-out ${
                  this.isOpen ? 'animate-[slide-in-right_0.3s_ease-out]' : 'pointer-events-none translate-x-full'
                } shadow-[0_18px_56px_rgba(0,0,0,0.3)]`
              : `relative z-[60] order-last max-w-[92vw] transition-[width,opacity] duration-200 ${
                  this.isOpen
                    ? 'w-[300px] border-l border-[var(--border)] opacity-100'
                    : 'pointer-events-none w-0 border-transparent opacity-0'
                }`
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          {this.children}
        </aside>
      </>
    );
  }
}
