import type { MouseEvent, ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { Reactor, prop, state, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { NavUtils } from '@/lib/nav-utils';
import { AdminServices } from '@/lib/admin-services';
export class NavItemView extends Reactor {
  private static readonly adminServices = AdminServices.getInstance();

  @prop declare icon?: ReactNode;
  @prop declare label: string;
  @prop declare href: string;
  @prop declare persistenceKey?: string;
  @prop declare active?: boolean;
  @prop declare onClick?: () => void;
  @prop declare children?: any[];
  @prop declare isMini?: boolean;
  @prop declare isGroupHeader?: boolean;
  @prop declare version?: string;
  @prop declare showHoverPreview?: boolean;
  @prop declare onHoverPreviewStart?: (path: string) => void;
  @prop declare onHoverPreviewEnd?: () => void;
  /** Resolved active primary path (honours secondary-panel sourcePaths). When it matches a child,
   * that child is highlighted instead of the raw best-prefix match. */
  @prop declare activePathOverride?: string;
  /** Raw pathname from `usePathname()`, supplied by the thin functional shim. */
  @prop declare rawPathname: string | null;

  /**
   * Seeded from the constructor rather than a field initializer: the initializer would read `@prop`
   * accessors declared later in the class body (TS2729).
   */
  @state expanded = false;

  constructor(props: Record<string, unknown>) {
    super(props);
    this.expanded = !!(this.active
      || this.computeIsChildActive(this.children, this.rawPathname, this.activePathOverride));
  }

  private get pathname(): string {
    return this.rawPathname || '';
  }

  private computeChildPaths(children: any[] | undefined): string[] {
    return (children || []).map((child) => NavUtils.normalizePath(child.path)).filter(Boolean) as string[];
  }

  private computeStorageKey(persistenceKey: unknown, href: unknown, label: unknown): string {
    return String(persistenceKey || href || label).trim();
  }

  private computeActiveChildPath(children: any[] | undefined, rawPathname: string | null, activePathOverride?: string): string {
    // Prefer the resolved active primary path (which honours secondary-panel sourcePaths) when it
    // points at one of our children — so a sub-page highlights its true parent rather than the
    // closest-prefix child. Fall back to plain best-prefix matching otherwise.
    const childPaths = this.computeChildPaths(children);
    const pathname = rawPathname || '';
    const override = NavUtils.normalizePath(activePathOverride);
    if (override && childPaths.includes(override)) return override;
    return NavUtils.resolveBestMatchPath(pathname, childPaths) || '';
  }

  private computeIsChildActive(children: any[] | undefined, rawPathname: string | null, activePathOverride?: string): boolean {
    return !!this.computeActiveChildPath(children, rawPathname, activePathOverride);
  }

  componentDidMount(): void {
    // Load persistence state ([storageKey] effect).
    const storageKey = this.computeStorageKey(this.persistenceKey, this.href, this.label);
    if (storageKey) {
      const saved = NavItemView.adminServices.uiPreference.readNavExpanded(storageKey);
      if (saved !== null) {
        this.expanded = saved;
      }
    }

    // Save persistence state ([expanded, storageKey] effect — runs on mount too).
    if (storageKey) {
      NavItemView.adminServices.uiPreference.writeNavExpanded(storageKey, this.expanded);
    }
  }

  componentDidUpdate(prevProps: Readonly<Record<string, unknown>>, prevState: Readonly<Record<string, unknown>>): void {
    const storageKey = this.computeStorageKey(this.persistenceKey, this.href, this.label);
    const prevStorageKey = this.computeStorageKey(prevProps.persistenceKey, prevProps.href, prevProps.label);

    // Load persistence state — [storageKey] effect re-runs only when storageKey changes.
    if (storageKey !== prevStorageKey) {
      if (storageKey) {
        const saved = NavItemView.adminServices.uiPreference.readNavExpanded(storageKey);
        if (saved !== null) {
          this.expanded = saved;
        }
      }
    }

    // Save persistence state — [expanded, storageKey] effect re-runs when either changes.
    if (this.expanded !== prevState.expanded || storageKey !== prevStorageKey) {
      if (storageKey) {
        NavItemView.adminServices.uiPreference.writeNavExpanded(storageKey, this.expanded);
      }
    }

    // Auto-expand when a child becomes active — [isChildActive] effect re-runs when it changes.
    const isChildActive = this.computeIsChildActive(this.children, this.rawPathname, this.activePathOverride);
    const prevIsChildActive = this.computeIsChildActive(
      prevProps.children as any[] | undefined,
      prevProps.rawPathname as string | null,
      prevProps.activePathOverride as string | undefined,
    );
    if (isChildActive !== prevIsChildActive && isChildActive) {
      this.expanded = true;
    }
  }

  @bound private handleClick(e: MouseEvent): void {
    const hasChildren = this.children && this.children.length > 0;
    if (this.isGroupHeader || (hasChildren && !this.expanded)) {
      if (this.isGroupHeader) {
        e.preventDefault();
      }
      this.expanded = !this.expanded;
    }
    this.onClick?.();
  }

  render(): ReactElement {
    const {
      icon, label, href, active, onClick, children, isMini, isGroupHeader, version,
      showHoverPreview, onHoverPreviewStart, onHoverPreviewEnd, expanded,
    } = this;

    const hasChildren = children && children.length > 0;
    const activeChildPath = this.computeActiveChildPath(children, this.rawPathname, this.activePathOverride);
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
            } ${isMini ? 'flex-col justify-center w-14 h-14 rounded-lg gap-1' : 'flex-1 justify-between px-2.5 py-1.5 rounded-lg'}`}
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
              <FrameworkIcons.Down
                size={14}
                className={`shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''} ${
                  isHighlighted ? 'text-white/60' : 'text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400'
                }`}
                onClick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); this.expanded = !expanded; }}
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
                  className={`relative flex items-center gap-2.5 rounded-lg py-1.5 pl-3 pr-2 text-[12px] transition-colors duration-150 ${
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
