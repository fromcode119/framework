import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { DropdownDirection } from '@/components/ui/enums/dropdown-direction.enum';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { ref, watch } from '@fromcode119/react-class-components';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { DropdownPositioning } from '@/components/ui/view/dropdown-positioning.client';

/**
 * A menu anchored to a trigger, drawn through a portal so no ancestor can clip it.
 *
 * The top of the chain: the lifecycle and the markup. The measurement and the listeners that keep it
 * in place live in `DropdownPositioning`.
 */
export class Dropdown extends DropdownPositioning {
  componentDidMount(): void {
    document.addEventListener('mousedown', this.handleClickOutside);
    if (this.isOpen) this.addPositionListeners();
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
      this.stopWatchingSize();
      if (this.positioned) this.positioned = false;
      return;
    }
    this.watchSize();
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
    this.stopWatchingSize();
  }

  /**
   * Rows another component adds (a plugin's actions in a record card's ⋯) arrive after the menu was
   * measured, and only re-render THAT component — this one never updates, so the panel kept the width it
   * had without them and opened past the right edge. The panel's own size is watched while it is open.
   */
  private sizeWatch: ResizeObserver | null = null;

  private watchSize(): void {
    const menu = this.menuRef.current;
    // A runtime without it (a test DOM) keeps the width measured on open.
    if (!menu || this.sizeWatch || !('ResizeObserver' in globalThis)) return;
    this.sizeWatch = new ResizeObserver(() => {
      const width = this.menuRef.current?.offsetWidth || 0;
      if (!width || width === this.measuredWidth) return;
      this.measuredWidth = width;
      this.updatePosition();
    });
    this.sizeWatch.observe(menu);
  }

  private stopWatchingSize(): void {
    this.sizeWatch?.disconnect();
    this.sizeWatch = null;
  }

  @watch('isOpen') onOpenChange(next: boolean): void {
    if (next) this.addPositionListeners();
    else this.removePositionListeners();
  }

  render(): ReactNode {
    const { trigger, items, header, panel, footer } = this;
    const { isOpen, coords } = this;

    return (
    <>
      <div
        className={`relative text-start ${this.block ? 'block w-full' : 'inline-block'}`}
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
              // The same limit for a panel that keeps its own head and foot in view and scrolls only between them.
              ['--fc-dropdown-max-h' as string]: `${coords.maxHeight}px`,
              overflowY: 'auto',
              minWidth: '220px',
              // Laid out (so it can be measured) but not shown until the measurement has been applied —
              // otherwise the first frame paints the unclamped guess and the panel visibly jumps.
              visibility: this.positioned ? 'visible' : 'hidden'
            }}
            // Sizes to its CONTENT between a floor and a ceiling, rather than a fixed `w-56`. At 224px
            // the account menu's avatar + gap left ~150px for the email, so any real address rendered
            // truncated (a long email address). `w-max` grows to fit, `min-w-56` keeps the previous
            // width as the minimum for short menus, and the cap keeps it on-screen.
            // The panel arrives once it has been MEASURED, never before: it is laid out hidden to be
            // measured, and an animation started then would be over by the time anything was on screen.
            // It asked for `animate-in fade-in-0 zoom-in-95`, which no stylesheet here defines, so until
            // now the menu simply appeared between two frames.
            className={`fc-menu-sheet w-max max-w-[min(22rem,calc(100vw-2rem))] z-[9999] ${
              this.positioned ? 'fc-enter fc-enter--menu' : ''
            } ${
              coords.direction === DropdownDirection.UP ? 'origin-bottom-right' : 'origin-top-right'
            }`}
          >
            {header && (
              <div className="px-4 py-3 border-b fc-tone-line">
                {header}
              </div>
            )}
            {panel ?? <div className="p-1.5 overflow-y-auto" style={{ maxHeight: coords.maxHeight }}>
              {DropdownPositioning.groupItems(items).map((group, groupIdx) => (
                <Fragment key={group.section ?? `group-${groupIdx}`}>
                {group.scrolls && group.section ? (
                  <div className="mt-2 mb-0.5 px-3 fc-size-xs font-medium fc-tone-muted">
                    {group.section}
                  </div>
                ) : null}
                <div
                  className={group.scrolls ? 'overflow-y-auto overscroll-contain' : undefined}
                  style={group.scrolls ? { maxHeight: '14rem' } : undefined}
                >
                  {group.items.map((item, idx) => {
                const isDanger = item.variant === DropdownItemVariant.DANGER;

                return (
                  <Fragment key={item.label}>
                    {/*
                      * A label and the space above it start a group — no rule. The rule read as a
                      * divider belonging to the row beneath it, which in a menu of actions looks
                      * like a separator between two unrelated things rather than a heading.
                      */}
                    {item.section && !group.scrolls ? (
                      <div className="mt-2 mb-0.5 px-3 fc-size-xs font-medium fc-tone-muted">
                        {item.section}
                      </div>
                    ) : null}
                    {/*
                      * One rule, and only above the destructive action that closes a grouped menu
                      * (Sign out). It used to fall on the last row of EVERY later group, so a
                      * three-option language group was split between its second and third choice.
                      */}
                    {isDanger && groupIdx !== 0 && idx === group.items.length - 1 && !item.section && (
                      <div className="my-1 h-px bg-[color:var(--fc-border)]" />
                    )}
                    <button
                      title={item.label}
                      onClick={() => {
                        item.onClick();
                        this.isOpen = false;
                      }}
                      // The console's menu row: 32px, 13/20, a 6px corner. It drew its own with a
                      // 12px corner and 12px of side padding, so this menu and the card's menu —
                      // which open two rows apart — were different objects.
                      className="fc-menu-action"
                      data-danger={isDanger ? 'true' : undefined}
                    >
                      {item.icon && (
                        <span className="fc-menu-action__icon">
                          {item.icon}
                        </span>
                      )}
                      <span className="fc-menu-action__text">
                        <span className="fc-menu-action__label">{item.label}</span>
                        {item.detail ? (
                          <span className="fc-menu-action__detail">{item.detail}</span>
                        ) : null}
                      </span>
                      {/*
                        * The chosen row of a set carries a tick, as a menu does; the others keep an
                        * empty slot of the same width so the labels stay in one column. A radio ring
                        * on every row made a menu look like a form.
                        */}
                      {item.selectable ? (
                        <span className="fc-dropdown-choice" data-selected={item.selected ? 'true' : 'false'}>
                          {item.selected ? <FrameworkIcons.Check size={15} /> : null}
                        </span>
                      ) : null}
                    </button>
                  </Fragment>
                );
                  })}
                </div>
                </Fragment>
              ))}
            </div>}
            {footer ? <div className="fc-dropdown-footer">{footer}</div> : null}
          </div>
        </RootFramework>
      )}
    </>
    );
  }
}
