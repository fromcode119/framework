import type { PointerEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { DashboardWidgetSize } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IDashboardWidgetDefinition } from '@/lib/dashboard/interfaces/dashboard-widget-definition.interface';

/**
 * One widget on the dashboard grid. Outside Customize it is only the widget, at its width; a widget that
 * renders nothing (nothing needs you) takes no space. In Customize it gains a bar to drag it, move it,
 * change its width and remove it, and its content stops taking clicks so arranging never follows a link.
 * The whole widget is the drag handle (DashboardPointerDrag); the widget it is dragged over is marked
 * as the place it will land.
 *
 * A widget that has nothing to show draws its empty state (`data-empty-state`). Outside Customize such a
 * widget steps aside — the board names it on one "nothing waiting" line instead of a whole card saying
 * so — and comes back by itself the moment it has something. In Customize every widget is shown.
 */
export class DashboardWidgetFrame extends PureReactor {
  @prop declare definition: IDashboardWidgetDefinition;
  @prop declare size: DashboardWidgetSize;
  @prop declare editing: boolean;
  @prop declare dragging: boolean;
  /** Another widget is being dragged over this one: it will land here. */
  @prop declare dropTarget: boolean;
  @prop declare isFirst: boolean;
  @prop declare isLast: boolean;
  @prop declare onRemove: () => void;
  @prop declare onResize: (size: DashboardWidgetSize) => void;
  @prop declare onShift: (step: number) => void;
  @prop declare onPointerDown: (event: PointerEvent) => void;
  /** This widget is showing only its empty state; the board lists it on the "nothing waiting" line. */
  @prop declare quiet: boolean;
  @prop declare onQuietChange: (quiet: boolean) => void;

  private observer: MutationObserver | null = null;
  private sizer: ResizeObserver | null = null;
  private reported: boolean | null = null;

  /**
   * The grid packs widgets by their real height (`.fc-dashboard__grid--packed` lays out 1px rows), so a
   * short list beside a tall chart does not leave a hole the height of the chart under it.
   */
  private packed: Element | null = null;

  private readonly pack = (node: HTMLDivElement): void => {
    const content = node.firstElementChild as HTMLElement | null;
    if (content === this.packed || typeof ResizeObserver === 'undefined') return;
    this.sizer?.disconnect();
    this.packed = content;
    if (!content) { node.style.gridRowEnd = ''; return; }
    this.sizer = new ResizeObserver(() => {
      const gap = parseFloat(getComputedStyle(node.parentElement as Element).getPropertyValue('--fc-dashboard-gap')) || 0;
      node.style.gridRowEnd = `span ${Math.ceil(content.getBoundingClientRect().height + gap)}`;
    });
    this.sizer.observe(content);
  };

  private readonly watch = (node: HTMLDivElement | null): void => {
    this.observer?.disconnect();
    this.observer = null;
    this.sizer?.disconnect();
    this.sizer = null;
    this.packed = null;
    if (!node || typeof MutationObserver === 'undefined') return;
    const check = () => {
      const quiet = node.querySelector('[data-empty-state]') !== null;
      if (quiet !== this.reported) { this.reported = quiet; this.onQuietChange(quiet); }
      this.pack(node);
    };
    this.observer = new MutationObserver(check);
    this.observer.observe(node, { childList: true, subtree: true });
    check();
  };

  componentWillUnmount(): void {
    this.observer?.disconnect();
    this.sizer?.disconnect();
  }

  private get span(): string {
    if (this.size === DashboardWidgetSize.LARGE) return 'md:col-span-2 lg:col-span-3';
    if (this.size === DashboardWidgetSize.MEDIUM) return 'md:col-span-2';
    return '';
  }

  render(): ReactNode {
    if (!this.editing) {
      return <div ref={this.watch} className={`min-w-0 empty:hidden ${this.span} ${this.quiet ? 'fc-dashboard__widget--quiet' : ''}`}>{this.definition.render()}</div>;
    }
    const outline = this.dragging
      ? 'opacity-40 outline-indigo-400'
      : this.dropTarget ? 'outline-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10' : 'outline-slate-300 dark:outline-slate-700';
    return (
      <div
        data-widget-key={this.definition.key}
        onPointerDown={this.onPointerDown}
        className={`min-w-0 cursor-grab touch-none select-none rounded-2xl outline-dashed outline-2 outline-offset-4 transition-[opacity,background-color] active:cursor-grabbing ${outline} ${this.span}`}
      >
        {this.renderBar()}
        <div className="pointer-events-none" aria-hidden>
          {this.definition.render() ?? null}
        </div>
      </div>
    );
  }

  private renderBar(): ReactNode {
    const label = this.definition.label;
    return (
      <div
        className="mb-2 flex items-center gap-2 rounded-xl bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800"
        title={AdminI18n.t('dashboard.widgets.dragHint')}
      >
        <FrameworkIcons.Grid size={14} className="shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        {this.definition.source ? (
          <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">{this.definition.source}</span>
        ) : null}
        {this.renderSizes()}
        {this.iconButton(<FrameworkIcons.ChevronUp size={14} />, AdminI18n.t('dashboard.widgets.moveEarlier', { label }), () => this.onShift(-1), this.isFirst)}
        {this.iconButton(<FrameworkIcons.ChevronDown size={14} />, AdminI18n.t('dashboard.widgets.moveLater', { label }), () => this.onShift(1), this.isLast)}
        {this.iconButton(<FrameworkIcons.Close size={14} />, AdminI18n.t('dashboard.widgets.remove', { label }), this.onRemove, false)}
      </div>
    );
  }

  private renderSizes(): ReactNode {
    const sizes = [DashboardWidgetSize.SMALL, DashboardWidgetSize.MEDIUM, DashboardWidgetSize.LARGE];
    return (
      <div className="flex shrink-0 rounded-lg bg-white p-0.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700" role="group" aria-label={AdminI18n.t('dashboard.widgets.width')}>
        {sizes.map((size) => (
          <button
            key={size.value}
            type="button"
            onClick={() => this.onResize(size)}
            aria-pressed={size === this.size}
            title={AdminI18n.t(`dashboard.widgets.size.${size.value}`)}
            className={`rounded-md px-1.5 text-[11px] font-semibold leading-5 ${size === this.size ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            {AdminI18n.t(`dashboard.widgets.sizeShort.${size.value}`)}
          </button>
        ))}
      </div>
    );
  }

  private iconButton(icon: ReactNode, label: string, onClick: () => void, disabled: boolean): ReactNode {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={label}
        aria-label={label}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-slate-900 dark:hover:text-white"
      >
        {icon}
      </button>
    );
  }
}
