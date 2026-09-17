import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import type { IDropdownCoords } from '@/components/ui/interfaces/dropdown-coords.interface';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { DropdownDirection } from '@/components/ui/enums/dropdown-direction.enum';
import { DropdownPlacement } from '@/components/ui/enums/dropdown-placement.enum';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound, ref, watch } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';

/**
 * Where an open dropdown menu is drawn, and what closes it.
 *
 * The base of the dropdown's chain: the menu is rendered in a portal, so it cannot inherit a position
 * from the trigger's box — it is MEASURED against the viewport on every open, scroll and resize, and
 * flipped or clamped when it would otherwise run off the screen.
 *
 * `positioned` exists so the first paint is not in the wrong place: the menu stays hidden until a
 * real measurement has been taken, rather than appearing at the origin and jumping.
 */
export abstract class DropdownPositioning extends Reactor {
  @prop declare trigger: ReactNode;
  @prop declare items: IDropdownItem[];
  @prop declare align?: HorizontalAlign;
  @prop declare header?: ReactNode;
  /**
   * Lets the trigger fill its container. The wrapper is `inline-block` by default — right for a
   * button in a toolbar, wrong for the sidebar account card, which shrank to the width of the name
   * inside it and sat visibly narrower than everything around it.
   */
  @prop declare block?: boolean;
  @prop declare placement?: DropdownPlacement;

  @ref declare triggerRef: Ref<HTMLDivElement>;
  @ref declare menuRef: Ref<HTMLDivElement>;

  /** The panel's last measured width, so the clamp never sizes itself from the trigger. */
  protected measuredWidth = 0;

  /**
   * False until the panel has been measured in place.
   *
   * The position can only be computed correctly once the panel exists, which is one commit after the
   * click — so for that one frame it sat at the unclamped guess and the user SAW it flash off the edge
   * before snapping back. It is laid out but not painted until the real measurement has landed.
   */
  @state positioned = false;

  @state isOpen = false;
  @state coords: IDropdownCoords = { top: 0, left: 0, width: 0, maxHeight: 320, direction: DropdownDirection.DOWN };

  @bound updatePosition(): void {
    if (!this.triggerRef.current) return;
    if (this.placement === DropdownPlacement.BESIDE) {
      this.positionBeside();
      return;
    }

    const gap = 12;
    const viewportPadding = 16;
    const minMenuHeight = 180;
    const rect = this.triggerRef.current.getBoundingClientRect();
    const menuHeight = this.menuRef.current?.offsetHeight || 0;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
    const availableAbove = rect.top - viewportPadding;
    const shouldOpenUp = menuHeight > availableBelow && availableAbove > availableBelow;
    const maxHeight = Math.max(
      minMenuHeight,
      (shouldOpenUp ? availableAbove : availableBelow) - gap,
    );

    this.coords = {
      top: shouldOpenUp
        ? Math.max(viewportPadding, rect.top - Math.min(menuHeight || maxHeight, maxHeight) - gap)
        : Math.min(window.innerHeight - viewportPadding, rect.bottom + gap),
      left: this.clampedLeft(rect, viewportPadding),
      width: rect.width,
      maxHeight,
      direction: shouldOpenUp ? DropdownDirection.UP : DropdownDirection.DOWN,
    };
  }

  /**
   * Alongside the trigger, its BOTTOM edges aligned.
   *
   * For a trigger at the foot of the sidebar, stacking upward covers the navigation the menu belongs
   * to. Beside it, both stay readable. The panel is pulled up only as far as it must be to stay on
   * screen, so a short menu still lines up with the row that opened it.
   */
  protected positionBeside(): void {
    const gap = 8;
    const viewportPadding = 16;
    const rect = this.triggerRef.current!.getBoundingClientRect();
    const menuHeight = this.menuRef.current?.offsetHeight || 0;
    const menuWidth = this.menuRef.current?.offsetWidth || this.measuredWidth || rect.width;
    const available = window.innerHeight - viewportPadding * 2;
    const height = Math.min(menuHeight || available, available);

    const preferredLeft = rect.right + gap;
    const fitsRight = preferredLeft + menuWidth + viewportPadding <= window.innerWidth;

    this.coords = {
      top: Math.max(viewportPadding, Math.min(rect.bottom - height, window.innerHeight - height - viewportPadding)),
      left: fitsRight ? preferredLeft : Math.max(viewportPadding, rect.left - menuWidth - gap),
      width: rect.width,
      maxHeight: available,
      direction: DropdownDirection.UP,
    };
  }

  /**
   * Keep the panel inside the viewport horizontally.
   *
   * The vertical axis flipped and clamped; the horizontal axis just trusted the trigger's position, so a
   * trigger near the right edge — the Actions button in the last column of a wide table, the account
   * button in the header — opened a panel that ran off the screen and could not be reached. The preferred
   * edge is still honoured; it is only pulled back when it would leave the viewport.
   */
  protected clampedLeft(rect: DOMRect, viewportPadding: number): number {
    const menuWidth = this.menuRef.current?.offsetWidth || this.measuredWidth || rect.width;
    const preferred = this.align === HorizontalAlign.LEFT ? rect.left : rect.right - menuWidth;
    const rightLimit = window.innerWidth - menuWidth - viewportPadding;
    return Math.max(viewportPadding, Math.min(preferred, rightLimit));
  }

  protected addPositionListeners(): void {
    this.updatePosition();
    window.addEventListener('scroll', this.updatePosition, true);
    window.addEventListener('resize', this.updatePosition);
  }

  protected removePositionListeners(): void {
    window.removeEventListener('scroll', this.updatePosition, true);
    window.removeEventListener('resize', this.updatePosition);
  }

  @bound handleClickOutside(event: MouseEvent): void {
    if (
      this.triggerRef.current && !this.triggerRef.current.contains(event.target as Node) &&
      this.menuRef.current && !this.menuRef.current.contains(event.target as Node)
    ) {
      this.isOpen = false;
    }
  }

  @bound toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  /**
   * Splits a flat item list into the groups its `section` headings already imply.
   *
   * Rendering was one flat map, so a group could not be given its own scrolling box — the whole menu
   * scrolled as one and a long group (the sites) pushed everything after it out of reach.
   */
  protected static groupItems(items: IDropdownItem[]): Array<{ section?: string; scrolls: boolean; items: IDropdownItem[] }> {
    const groups: Array<{ section?: string; scrolls: boolean; items: IDropdownItem[] }> = [];
    for (const item of items) {
      if (item.section || groups.length === 0) {
        groups.push({ section: item.section, scrolls: item.scrolls === true, items: [item] });
        continue;
      }
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  }
}
