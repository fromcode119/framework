import type { KeyboardEvent } from 'react';
import { PureReactor, prop, bound, Ref } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { ISecondaryPanelItem } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SecondarySidebarPanelBody } from '@/app/components/view/secondary-sidebar-panel-body.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
export class SecondarySidebarDesktop extends PureReactor {
  @prop declare items: ISecondaryPanelItem[];
  @prop declare sourceLabel: string;
  @prop declare pathname: string;
  @prop declare isOpen: boolean;
  @prop declare hoverOpen?: boolean;
  @prop declare overlayLeftClass?: string;
  @prop declare hasActiveItem: boolean;
  @prop declare triggerRef: Ref<HTMLElement>;
  @prop declare onOpen: () => void;
  @prop declare onClose: () => void;
  @prop declare onPanelMouseEnter?: () => void;
  @prop declare onPanelMouseLeave?: () => void;
  @prop declare onItemActivate?: (item?: ISecondaryPanelItem) => void;
  @prop declare onListKeyDown: (event: KeyboardEvent<HTMLElement>) => void;

  // A hover-preview pops the panel out as a floating overlay even when the user
  // hasn't docked it. Docked-open keeps reserving layout width and pushes content.
  private get isOverlay(): boolean {
    return !this.isOpen && Boolean(this.hoverOpen);
  }

  private get expanded(): boolean {
    return this.isOpen || Boolean(this.hoverOpen);
  }

  private get collapsedLabel(): string {
    return (this.sourceLabel || AdminI18n.t('shell.nav.menu')).trim();
  }

  @bound
  private activateItem(item?: ISecondaryPanelItem): void {
    this.onItemActivate?.(item);
  }

  render() {
    if (!this.expanded) {
      // Collapsed: reserve ZERO layout width (w-0) so content fills the space; a clearly visible
      // expand handle floats over the content's left edge instead of cutting a gap. (The previous
      // 4px sliver was effectively invisible, so users couldn't find any way to re-open the panel.)
      const collapsedLabel = this.collapsedLabel;
      return (
        <div className="sticky top-16 z-50 h-[calc(100vh-4rem)] w-0 shrink-0 self-start overflow-visible">
          <Button
            elementRef={this.triggerRef}
            type="button"
            title={AdminI18n.t('shell.nav.openNamed', { name: collapsedLabel })}
            aria-label={AdminI18n.t('shell.nav.openNamed', { name: collapsedLabel })}
            aria-expanded="false"
            aria-controls={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
            onClick={this.onOpen}
            variant={ButtonVariant.SECONDARY}
            size={FieldSize.ICON}
            className="fc-btn--raised absolute start-2 top-20 z-50"
          >
            <FrameworkIcons.Right size={14} />
          </Button>
        </div>
      );
    }

    return (
      <aside
        id={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
        className={`${this.isOverlay
          ? `fixed top-16 ${this.overlayLeftClass || 'left-64'} z-40 h-[calc(100vh-4rem)] rounded-r-xl`
          : 'sticky top-0 z-30 ms-[-1px] h-screen shrink-0'} flex w-[var(--secondary-sidebar-width)] overflow-hidden border-e fc-tone-line fc-canvas`}
        aria-label={AdminI18n.t('shell.nav.secondary')}
        onMouseEnter={this.onPanelMouseEnter}
        onMouseLeave={this.onPanelMouseLeave}
      >
        <Button type="button" variant={ButtonVariant.GHOST} size={FieldSize.ICON} className="absolute end-3 top-3 z-10" onClick={this.onClose} aria-label={AdminI18n.t('shell.nav.minimize')}>
          <FrameworkIcons.Left size={14} />
        </Button>
        <SecondarySidebarPanelBody
          items={this.items}
          sourceLabel={this.sourceLabel}
          pathname={this.pathname}
          onListKeyDown={this.onListKeyDown}
          onItemActivate={this.activateItem}
          onMouseEnter={this.onPanelMouseEnter}
          onMouseLeave={this.onPanelMouseLeave}
        />
      </aside>
    );
  }
}
