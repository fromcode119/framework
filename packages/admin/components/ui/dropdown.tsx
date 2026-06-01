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
              minWidth: '14rem'
            }}
            className={`w-56 max-w-[calc(100vw-2rem)] rounded-2xl border z-[9999] animate-in zoom-in-95 duration-500 overflow-hidden ${
              coords.direction === 'up' ? 'origin-bottom-right slide-in-from-bottom-2' : 'origin-top-right slide-in-from-top-2'
            }}
              bg-white/95 backdrop-blur-2xl border-slate-200/60 shadow-slate-200/50 ring-1 ring-black/[0.02] 
              dark:bg-slate-900/95 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-black dark:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.5)]`}
          >
            {header && (
              <div className="px-5 py-4 border-b mb-1 relative overflow-hidden border-slate-100 bg-slate-50/50 dark:border-white/5 dark:bg-white/[0.02]">
                <div className="relative z-10">{header}</div>
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-500/10 rounded-full blur-3xl" />
              </div>
            )}
            <div className="p-2 space-y-0.5 overflow-y-auto" style={{ maxHeight: coords.maxHeight }}>
              {items.map((item, idx) => {
                const isLast = idx === items.length - 1;
                const isDanger = item.variant === 'danger';

                return (
                  <React.Fragment key={item.label}>
                    {isLast && idx !== 0 && (
                      <div className="my-1.5 h-[1px] mx-3 bg-slate-100 dark:bg-white/5" />
                    )}
                    <button
                      title={item.label}
                      onClick={() => {
                        item.onClick();
                        this.setState({ isOpen: false });
                      }}
                      className={`group flex items-center w-full gap-3 px-3 py-2 text-[12px] font-bold rounded-xl transition-all duration-300 overflow-hidden relative ${
                        isDanger 
                          ? 'text-rose-500 hover:bg-rose-500/10' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
                      }`}
                    >
                      {item.icon && (
                        <div className={`flex-shrink-0 transition-all duration-300 group-hover:scale-110 h-7 w-7 rounded-lg flex items-center justify-center ${
                          isDanger 
                            ? 'bg-rose-500/10 text-rose-500' 
                            : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-indigo-500/20 dark:group-hover:text-indigo-400'
                        }`}>
                          {item.icon}
                        </div>
                      )}
                      <span className="truncate text-left flex-1 font-semibold tracking-wide text-[12px]">{item.label}</span>
                      
                      {!isDanger && (
                        <div className="h-1.5 w-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-0 group-hover:scale-100 bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.4)] dark:bg-indigo-500 dark:shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                      )}
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
