import type { KeyboardEvent, ReactNode } from 'react';
import { prop, ref, bound } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { NavUtils } from '@/lib/nav-utils';
import { SecondarySidebarDesktop } from '@/app/components/view/secondary-sidebar-desktop.client';
import { SecondarySidebarMobile } from '@/app/components/view/secondary-sidebar-mobile.client';
import { SecondarySidebarAccessibilityService } from '@/app/services/secondary-sidebar-accessibility-service';
import type { ISecondaryPanelContext, ISecondaryPanelItem } from '@fromcode119/react';
import { SecondarySidebarMode } from '@/app/services/enums/secondary-sidebar-mode.enum';

export class SecondarySidebar extends AdminComponent {
  private static readonly accessibilityService = new SecondarySidebarAccessibilityService();
  @prop declare mode: SecondarySidebarMode;
  @prop declare items: ISecondaryPanelItem[];
  @prop declare sourceLabel: string;
  @prop declare isOpen: boolean;
  @prop declare onOpen: () => void;
  @prop declare onClose: () => void;
  @prop declare onPanelMouseEnter?: () => void;
  @prop declare onPanelMouseLeave?: () => void;
  @prop declare onItemActivate?: (item?: ISecondaryPanelItem) => void;
  @prop declare parentPrimaryPath?: string;
  /** When true (and not docked open), the panel renders as a floating overlay over
   *  the content — used for hover-preview so it never reserves layout width. */
  @prop declare hoverOpen?: boolean;
  /** Tailwind left-offset class to anchor the hover overlay just after the primary
   *  sidebar (e.g. 'left-64' full, 'left-[72px]' mini). */
  @prop declare overlayLeftClass?: string;

  @ref declare dialogRef: Ref<HTMLDivElement>;
  @ref declare triggerRef: Ref<HTMLButtonElement>;

  private previousFocus: HTMLElement | null = null;
  private focusTrapped = false;

  /**
   * `context` is a reserved React.Component instance field, so this prop is read off `this.props`
   * rather than declared with `@prop` (which would install a getter React's constructor then
   * fails to assign over). Reactor's `ReservedMember` guard enforces that at decoration time.
   */
  private get panelContext(): ISecondaryPanelContext | null {
    return (this.props as { context?: ISecondaryPanelContext | null }).context ?? null;
  }

  private get liveMessage(): string {
    return this.panelContext ? `Secondary navigation: ${this.panelContext.label}` : 'Secondary navigation updated';
  }

  private get hasItems(): boolean {
    return this.items.length > 0;
  }

  private get isDesktop(): boolean {
    return this.mode === SecondarySidebarMode.DESKTOP;
  }

  private get hasActiveItem(): boolean {
    return this.items.some((item) => NavUtils.isPathMatch(this.pathname, item?.path || ''));
  }

  componentDidMount(): void {
    this.captureFocus();
  }

  componentDidUpdate(prevProps: Readonly<Record<string, unknown>>): void {
    const modeChanged = (prevProps.mode === SecondarySidebarMode.DESKTOP) !== this.isDesktop;
    if (prevProps.isOpen === this.isOpen && !modeChanged) {
      return;
    }

    this.releaseFocus();
    this.captureFocus();
  }

  componentWillUnmount(): void {
    this.releaseFocus();
  }

  private captureFocus(): void {
    if (!this.isOpen || this.isDesktop) {
      return;
    }

    this.previousFocus = document.activeElement as HTMLElement;
    this.focusTrapped = true;
    const focusable = SecondarySidebar.accessibilityService.getFocusableElements(this.dialogRef.current);
    focusable[0]?.focus();
  }

  private releaseFocus(): void {
    if (!this.focusTrapped) {
      return;
    }

    this.focusTrapped = false;
    this.previousFocus?.focus();
  }

  @bound
  handleOverlayKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const elements = SecondarySidebar.accessibilityService.getFocusableElements(this.dialogRef.current);
    if (!elements.length) {
      return;
    }

    const first = elements[0];
    const last = elements[elements.length - 1];
    const activeElement = document.activeElement as HTMLElement | null;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  @bound
  handleListKeyDown(event: KeyboardEvent<HTMLElement>): void {
    const links = SecondarySidebar.accessibilityService.getLinkElements(event.currentTarget as HTMLElement);
    if (!links.length) {
      return;
    }

    const activeIndex = links.findIndex((entry) => entry === document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      links[(activeIndex + 1 + links.length) % links.length]?.focus();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      links[(activeIndex - 1 + links.length) % links.length]?.focus();
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      links[0]?.focus();
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      links[links.length - 1]?.focus();
      return;
    }

    if (event.key === ' ' || event.key === 'Enter') {
      const current = document.activeElement as HTMLAnchorElement | null;
      if (current?.dataset.secondaryLink === 'true') {
        event.preventDefault();
        current.click();
      }
    }
  }

  @bound
  handleItemActivate(item?: ISecondaryPanelItem): void {
    this.onItemActivate?.(item);
  }

  render(): ReactNode {
    if (!this.hasItems) {
      return null;
    }

    if (this.isDesktop) {
      return (
        <SecondarySidebarDesktop
          items={this.items}
          sourceLabel={this.sourceLabel}
          pathname={this.pathname}
          isOpen={this.isOpen}
          hoverOpen={this.hoverOpen}
          overlayLeftClass={this.overlayLeftClass}
          hasActiveItem={this.hasActiveItem}
          triggerRef={this.triggerRef}
          onOpen={this.onOpen}
          onClose={this.onClose}
          onPanelMouseEnter={this.onPanelMouseEnter}
          onPanelMouseLeave={this.onPanelMouseLeave}
          onItemActivate={this.handleItemActivate}
          onListKeyDown={this.handleListKeyDown}
        />
      );
    }

    return (
      <SecondarySidebarMobile
        items={this.items}
        sourceLabel={this.sourceLabel}
        pathname={this.pathname}
        mode={this.mode}
        isOpen={this.isOpen}
        liveMessage={this.liveMessage}
        dialogRef={this.dialogRef}
        triggerRef={this.triggerRef}
        onOpen={this.onOpen}
        onClose={this.onClose}
        onItemActivate={this.handleItemActivate}
        onOverlayKeyDown={this.handleOverlayKeyDown}
        onListKeyDown={this.handleListKeyDown}
      />
    );
  }
}
