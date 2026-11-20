import type { KeyboardEvent, ReactNode } from 'react';
import { PureReactor, prop, bound, Ref } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { ISecondaryPanelItem } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SecondarySidebarPanelBody } from '@/app/components/view/secondary-sidebar-panel-body.client';
import { SecondarySidebarMode } from '@/app/services/enums/secondary-sidebar-mode.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
export class SecondarySidebarMobile extends PureReactor {
  @prop declare items: ISecondaryPanelItem[];
  @prop declare sourceLabel: string;
  @prop declare pathname: string;
  @prop declare mode: SecondarySidebarMode;
  @prop declare isOpen: boolean;
  @prop declare liveMessage: string;
  @prop declare dialogRef: Ref<HTMLDivElement>;
  @prop declare triggerRef: Ref<HTMLElement>;
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
      <Button
        elementRef={this.triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={this.isOpen}
        aria-controls={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
        onClick={this.onOpen}
        variant={ButtonVariant.SECONDARY}
        size={FieldSize.ICON}
        className={`fc-btn--raised fixed z-[170] ${this.mode === SecondarySidebarMode.MOBILE ? 'bottom-6 end-6' : 'bottom-6 start-[84px]'}`}
      >
        <FrameworkIcons.Right size={18} />
      </Button>

      {this.isOpen && (
        <div className="fixed inset-0 z-[180]">
          <div className="absolute inset-0 fc-tone-scrim" onClick={this.onClose} />
          <div
            ref={this.dialogRef}
            id={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
            role="dialog"
            aria-modal="true"
            aria-label={AdminI18n.t('shell.nav.secondary')}
            className={`absolute top-0 bottom-0 w-[var(--secondary-sidebar-width)] overflow-hidden fc-canvas shadow-2xl  flex ${this.mode === SecondarySidebarMode.MOBILE ? 'end-0' : 'start-[72px] shadow-[-18px_0_36px_-28px_rgba(79,70,229,0.26),-10px_0_24px_-24px_rgba(15,23,42,0.22)] dark:shadow-[-18px_0_36px_-28px_rgba(99,102,241,0.18),-10px_0_24px_-24px_rgba(2,6,23,0.88)]'}`}
            onKeyDown={this.onOverlayKeyDown}
          >
            <div className="flex min-w-0 flex-1 flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b fc-tone-line fc-canvas ">
              <h2 className="fc-size-sm font-medium fc-tone-text">{AdminI18n.t('shell.nav.secondaryTitle')}</h2>
              <Button type="button" variant={ButtonVariant.GHOST} size={FieldSize.ICON} onClick={this.onClose} aria-label={AdminI18n.t('shell.nav.closeSecondary')}>
                <FrameworkIcons.Close size={16} />
              </Button>
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
