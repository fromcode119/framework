"use client";

import React from 'react';
import { RootFramework } from '@fromcode119/react';

interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger';
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  header?: React.ReactNode;
}

interface DropdownCoords {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  direction: 'up' | 'down';
}

interface DropdownState {
  isOpen: boolean;
  coords: DropdownCoords;
}

export class Dropdown extends React.Component<DropdownProps, DropdownState> {
  private readonly triggerRef = React.createRef<HTMLDivElement>();
  private readonly menuRef = React.createRef<HTMLDivElement>();

  state: DropdownState = {
    isOpen: false,
    coords: { top: 0, left: 0, width: 0, maxHeight: 320, direction: 'down' },
  };

  private updatePosition = (): void => {
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

    this.setState({
      coords: {
        top: shouldOpenUp
          ? Math.max(viewportPadding, rect.top - Math.min(menuHeight || maxHeight, maxHeight) - gap)
          : Math.min(window.innerHeight - viewportPadding, rect.bottom + gap),
        left: rect.left,
        width: rect.width,
        maxHeight,
        direction: shouldOpenUp ? 'up' : 'down',
      },
    });
  };

  private handleClickOutside = (event: MouseEvent): void => {
    if (
      this.triggerRef.current && !this.triggerRef.current.contains(event.target as Node) &&
      this.menuRef.current && !this.menuRef.current.contains(event.target as Node)
    ) {
      this.setState({ isOpen: false });
    }
  };

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
    if (this.state.isOpen) this.addPositionListeners();
  }

  componentDidUpdate(_prevProps: DropdownProps, prevState: DropdownState): void {
    if (prevState.isOpen !== this.state.isOpen) {
      if (this.state.isOpen) this.addPositionListeners();
      else this.removePositionListeners();
    }
  }

  componentWillUnmount(): void {
    document.removeEventListener('mousedown', this.handleClickOutside);
    this.removePositionListeners();
  }

  render(): React.ReactNode {
    const { trigger, items, align = 'right', header } = this.props;
    const { isOpen, coords } = this.state;

    return (
    <>
      <div
        className="relative inline-block text-left"
        ref={this.triggerRef}
        onClick={() => this.setState({ isOpen: !isOpen })}
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
              left: align === 'right' ? 'auto' : coords.left,
              right: align === 'right' ? window.innerWidth - (coords.left + coords.width) : 'auto',
              minWidth: '13rem'
            }}
            className={`w-56 max-w-[calc(100vw-2rem)] rounded-xl border z-[9999] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 ${
              coords.direction === 'up' ? 'origin-bottom-right' : 'origin-top-right'
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
                const isDanger = item.variant === 'danger';

                return (
                  <React.Fragment key={item.label}>
                    {isLast && idx !== 0 && (
                      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                    )}
                    <button
                      title={item.label}
                      onClick={() => {
                        item.onClick();
                        this.setState({ isOpen: false });
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
                  </React.Fragment>
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
