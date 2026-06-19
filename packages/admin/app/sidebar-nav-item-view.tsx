"use client";

import React from 'react';
import Link from 'next/link';
import { FrameworkIcons } from '@fromcode119/react';
import { NavUtils } from '@/lib/nav-utils';
import { AdminServices } from '@/lib/admin-services';
import type { NavItemViewProps, NavItemViewState } from './sidebar-nav-item-view.interfaces';

const {
  Down = () => null,
} = (FrameworkIcons || {}) as any;

const adminServices = AdminServices.getInstance();

export class NavItemView extends React.Component<NavItemViewProps, NavItemViewState> {
  constructor(props: NavItemViewProps) {
    super(props);
    this.state = { expanded: !!(props.active || this.computeIsChildActive(props)) };
    this.handleClick = this.handleClick.bind(this);
  }

  private get pathname(): string {
    return this.props.rawPathname || '';
  }

  private computeChildPaths(props: NavItemViewProps = this.props): string[] {
    return (props.children || []).map((child) => NavUtils.normalizePath(child.path)).filter(Boolean) as string[];
  }

  private computeStorageKey(props: NavItemViewProps = this.props): string {
    return String(props.persistenceKey || props.href || props.label).trim();
  }

  private computeActiveChildPath(props: NavItemViewProps = this.props): string {
    // Prefer the resolved active primary path (which honours secondary-panel sourcePaths) when it
    // points at one of our children — so a sub-page highlights its true parent rather than the
    // closest-prefix child. Fall back to plain best-prefix matching otherwise.
    const childPaths = this.computeChildPaths(props);
    const pathname = props.rawPathname || '';
    const override = NavUtils.normalizePath(props.activePathOverride);
    if (override && childPaths.includes(override)) return override;
    return NavUtils.resolveBestMatchPath(pathname, childPaths) || '';
  }

  private computeIsChildActive(props: NavItemViewProps = this.props): boolean {
    return !!this.computeActiveChildPath(props);
  }

  componentDidMount(): void {
    // Load persistence state ([storageKey] effect).
    const storageKey = this.computeStorageKey();
    if (storageKey) {
      const saved = adminServices.uiPreference.readNavExpanded(storageKey);
      if (saved !== null) {
        this.setState({ expanded: saved });
      }
    }

    // Save persistence state ([expanded, storageKey] effect — runs on mount too).
    if (storageKey) {
      adminServices.uiPreference.writeNavExpanded(storageKey, this.state.expanded);
    }
  }

  componentDidUpdate(prevProps: NavItemViewProps, prevState: NavItemViewState): void {
    const storageKey = this.computeStorageKey();
    const prevStorageKey = this.computeStorageKey(prevProps);

    // Load persistence state — [storageKey] effect re-runs only when storageKey changes.
    if (storageKey !== prevStorageKey) {
      if (storageKey) {
        const saved = adminServices.uiPreference.readNavExpanded(storageKey);
        if (saved !== null) {
          this.setState({ expanded: saved });
        }
      }
    }

    // Save persistence state — [expanded, storageKey] effect re-runs when either changes.
    if (this.state.expanded !== prevState.expanded || storageKey !== prevStorageKey) {
      if (storageKey) {
        adminServices.uiPreference.writeNavExpanded(storageKey, this.state.expanded);
      }
    }

    // Auto-expand when a child becomes active — [isChildActive] effect re-runs when it changes.
    const isChildActive = this.computeIsChildActive();
    const prevIsChildActive = this.computeIsChildActive(prevProps);
    if (isChildActive !== prevIsChildActive && isChildActive) {
      this.setState({ expanded: true });
    }
  }

  private handleClick(e: React.MouseEvent): void {
    const { isGroupHeader, children, onClick } = this.props;
    const hasChildren = children && children.length > 0;
    if (isGroupHeader || (hasChildren && !this.state.expanded)) {
      if (isGroupHeader) {
        e.preventDefault();
      }
      this.setState({ expanded: !this.state.expanded });
    }
    onClick?.();
  }

  render(): React.ReactElement {
    const {
      icon, label, href, active, onClick, children, isMini, isGroupHeader, version,
      showHoverPreview, onHoverPreviewStart, onHoverPreviewEnd,
    } = this.props;
    const { expanded } = this.state;

    const hasChildren = children && children.length > 0;
    const activeChildPath = this.computeActiveChildPath();
    const isChildActive = !!activeChildPath;
    const displayLabel = label;

    // The parent is "highlighted" if it is active AND NO CHILD is active.
    const isHighlighted = active && !isChildActive;
    const isPreviewingSecondary = Boolean(showHoverPreview && !isHighlighted && !isChildActive);

    return (
      <div className="relative flex flex-col">
        <div
          className={`flex items-center group relative ${isMini ? 'justify-center w-full' : 'gap-0.5'}`}
          onMouseEnter={!isMini ? () => onHoverPreviewStart?.(href) : undefined}
          onMouseLeave={!isMini ? onHoverPreviewEnd : undefined}
        >
          <Link
            href={isGroupHeader ? '#' : href}
            onClick={this.handleClick}
            className={`flex items-center transition-colors duration-150 ${
              isHighlighted
                ? 'bg-indigo-600 text-white'
                : isPreviewingSecondary
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300'
                : isChildActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100'
            } ${isMini ? 'flex-col justify-center w-14 h-14 rounded-lg gap-1' : 'flex-1 justify-between px-2.5 py-1.5 rounded-md'}`}
          >
            <div className={`flex items-center justify-center ${isMini ? 'w-full' : 'gap-2.5'}`}>
              <span className={`${isHighlighted ? 'text-white' : isPreviewingSecondary ? 'text-indigo-500 dark:text-indigo-300' : isChildActive ? 'text-indigo-500' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors'} flex items-center justify-center shrink-0`}>
                {icon}
              </span>

              {!isMini && (
                <div className="flex flex-col">
                  <span className={`text-[12px] ${isHighlighted || isChildActive ? 'font-semibold' : 'font-medium'} tracking-[-0.01em] whitespace-nowrap`}>
                    {displayLabel}
                  </span>
                  {version && (
                    <span className={`text-[8px] font-mono mt-px opacity-50 ${isHighlighted ? 'text-white' : 'text-slate-400'}`}>
                      v{version}
                    </span>
                  )}
                </div>
              )}
            </div>

            {isMini && (
              <span className={`text-[8px] font-semibold tracking-tight text-center leading-none px-1 ${isHighlighted ? 'text-white' : isChildActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-700'}`}>
                {displayLabel.length > 9 ? displayLabel.substring(0, 8) + '..' : displayLabel}
              </span>
            )}

            {hasChildren && !isMini && (
              <Down
                size={14}
                className={`shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''} ${
                  isHighlighted ? 'text-white/60' : 'text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400'
                }`}
                onClick={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); this.setState({ expanded: !expanded }); }}
              />
            )}
          </Link>
        </div>

        {hasChildren && expanded && !isMini && (
          <div className="relative ml-[18px] mt-0.5 mb-1 flex flex-col gap-px border-l border-slate-200/70 pl-2 dark:border-slate-800">
            {children.map((child) => {
              const isSubActive = NavUtils.normalizePath(child.path) === activeChildPath;
              return (
                <Link
                  key={child.path}
                  href={child.path}
                  onClick={onClick}
                  className={`relative flex items-center gap-2.5 rounded-md py-1.5 pl-3 pr-2 text-[12px] transition-colors duration-150 ${
                    isSubActive
                      ? 'font-semibold text-indigo-600 dark:text-indigo-400'
                      : 'font-medium text-slate-400 hover:bg-slate-100/70 hover:text-slate-800 dark:text-slate-500 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'
                  }`}
                >
                  {isSubActive && (
                    <span className="absolute left-[-9px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-indigo-500" aria-hidden="true" />
                  )}
                  <span className="whitespace-nowrap tracking-[-0.01em]">{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }
}
