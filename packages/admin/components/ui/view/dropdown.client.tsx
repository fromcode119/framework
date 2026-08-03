import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import type { IDropdownCoords } from '@/components/ui/interfaces/dropdown-coords.interface';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { DropdownDirection } from '@/components/ui/enums/dropdown-direction.enum';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound, ref, watch } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { RootFramework } from '@fromcode119/react';

export class Dropdown extends Reactor {
  @prop declare trigger: ReactNode;
  @prop declare items: IDropdownItem[];
  @prop declare align?: HorizontalAlign;
  @prop declare header?: ReactNode;

  @ref declare triggerRef: Ref<HTMLDivElement>;
  @ref declare menuRef: Ref<HTMLDivElement>;

  /** The panel's last measured width, so the clamp never sizes itself from the trigger. */
  private measuredWidth = 0;

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
   * Keep the panel inside the viewport horizontally.
   *
   * The vertical axis flipped and clamped; the horizontal axis just trusted the trigger's position, so a
   * trigger near the right edge — the Actions button in the last column of a wide table, the account
   * button in the header — opened a panel that ran off the screen and could not be reached. The preferred
   * edge is still honoured; it is only pulled back when it would leave the viewport.
   */
  private clampedLeft(rect: DOMRect, viewportPadding: number): number {
    const menuWidth = this.menuRef.current?.offsetWidth || this.measuredWidth || rect.width;
    const preferred = this.align === HorizontalAlign.LEFT ? rect.left : rect.right - menuWidth;
    const rightLimit = window.innerWidth - menuWidth - viewportPadding;
    return Math.max(viewportPadding, Math.min(preferred, rightLimit));
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

  private addPositionListeners(): void {
    this.updatePosition();
    window.addEventListener('scroll', this.updatePosition, true);
    window.addEventListener('resize', this.updatePosition);
  }

  private removePositionListeners(): void {
    window.removeEventListener('scroll', this.updatePosition, true);
    window.removeEventListener('resize', this.updatePosition);
  }

  componentDidMount(): void {
    document.addEventListener('mousedown', this.handleClickOutside);
    if (this.isOpen) this.addPositionListeners();
  }

  @watch('isOpen') onOpenChange(next: boolean): void {
    if (next) this.addPositionListeners();
    else this.removePositionListeners();
  }

  /**
   * Re-position once the panel's REAL width is known.
   *
   * The first pass runs from the click handler, before React has committed the panel, so `menuRef` is
   * still null and the clamp sizes itself from the 78px trigger instead of the 224px menu — which put
   * the limit past the right edge and let the panel open off-screen anyway. A `requestAnimationFrame`
   * is not enough either: it can still run before the commit. Measuring on update is the point at which
   * the element definitively exists, and the width guard means this settles after exactly one extra pass.
   */
  componentDidUpdate(): void {
    if (!this.isOpen) {
      this.measuredWidth = 0;
      if (this.positioned) this.positioned = false;
      return;
    }
    const width = this.menuRef.current?.offsetWidth || 0;
    if (!width) return;
    if (width !== this.measuredWidth) {
      this.measuredWidth = width;
      this.updatePosition();
      return;
    }
    if (!this.positioned) this.positioned = true;
  }

  componentWillUnmount(): void {
    document.removeEventListener('mousedown', this.handleClickOutside);
    this.removePositionListeners();
  }

  render(): ReactNode {
    const { trigger, items, header } = this;
    const { isOpen, coords } = this;

    return (
    <>
      <div
        className="relative inline-block text-left"
        ref={this.triggerRef}
        onClick={this.toggleOpen}
      >
        <div className="cursor-pointer">
          {trigger}
        </div>
      </div>

      {isOpen && (
        <RootFramework>
          <div
            ref={this.menuRef}
            style={{
              position: 'fixed',
              top: coords.top,
              // Positioned from ONE edge only. Alignment is already resolved into `coords.left` by
              // `clampedLeft`, so there is nothing here that can push the panel off-screen.
              left: coords.left,
              right: 'auto',
              // `maxHeight` was computed on every reposition and then never applied, so a menu taller
              // than the space below the trigger simply ran off the bottom of the window. It scrolls
              // inside itself now instead.
              maxHeight: coords.maxHeight,
              overflowY: 'auto',
              minWidth: '13rem',
              // Laid out (so it can be measured) but not shown until the measurement has been applied —
              // otherwise the first frame paints the unclamped guess and the panel visibly jumps.
              visibility: this.positioned ? 'visible' : 'hidden'
            }}
            // Sizes to its CONTENT between a floor and a ceiling, rather than a fixed `w-56`. At 224px
            // the account menu's avatar + gap left ~150px for the email, so any real address rendered
            // truncated ("kristian.dimitrov@fr…"). `w-max` grows to fit, `min-w-56` keeps the previous
            // width as the minimum for short menus, and the cap keeps it on-screen.
            className={`w-max min-w-56 max-w-[min(22rem,calc(100vw-2rem))] rounded-xl border z-[9999] animate-in fade-in-0 zoom-in-95 duration-150 ${
              coords.direction === DropdownDirection.UP ? 'origin-bottom-right' : 'origin-top-right'
            } bg-white border-slate-200 shadow-lg shadow-slate-900/[0.08]
              dark:bg-slate-900 dark:border-slate-800 dark:shadow-black/40`}
          >
            {header && (
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                {header}
              </div>
            )}
            <div className="p-1.5 overflow-y-auto" style={{ maxHeight: coords.maxHeight }}>
              {items.map((item, idx) => {
                const isLast = idx === items.length - 1;
                const isDanger = item.variant === DropdownItemVariant.DANGER;

                return (
                  <Fragment key={item.label}>
                    {isLast && idx !== 0 && (
                      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                    )}
                    <button
                      title={item.label}
                      onClick={() => {
                        item.onClick();
                        this.isOpen = false;
                      }}
                      className={`flex items-center w-full gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-colors ${
                        isDanger
                          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {item.icon && (
                        <span className={`flex-shrink-0 ${isDanger ? 'text-rose-500' : 'text-slate-400'}`}>
                          {item.icon}
                        </span>
                      )}
                      <span className="truncate text-left flex-1">{item.label}</span>
                    </button>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </RootFramework>
      )}
    </>
    );
  }
}
