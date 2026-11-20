import { Tabs } from '@/components/ui/view/tabs.client';
import { Badge } from '@/components/ui/view/badge.client';
import type { PointerEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { DashboardWidgetSize } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { IDashboardWidgetDefinition } from '@/lib/dashboard/interfaces/dashboard-widget-definition.interface';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';

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
      const quiet = DashboardWidgetFrame.onlyEmpty(node);
      if (quiet !== this.reported) { this.reported = quiet; this.onQuietChange(quiet); }
      this.pack(node);
    };
    this.observer = new MutationObserver(check);
    this.observer.observe(node, { childList: true, subtree: true });
    check();
  };

  /**
   * Quiet means the widget says nothing BUT its empty state: an empty state somewhere inside, and no other
   * text outside the card's heading (its `header` or title). A widget with figures and one empty list keeps its card.
   */
  static onlyEmpty(node: HTMLElement): boolean {
    if (!node.querySelector('[data-empty-state]')) return false;
    const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.textContent?.trim()) continue;
      const parent = text.parentElement;
      if (parent && !parent.closest('[data-empty-state], header, .fc-record-card__head, h1, h2, h3, h4, h5, h6')) return false;
    }
    return true;
  }

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
    const state = this.dragging ? ' fc-widget-edit--dragging' : this.dropTarget ? ' fc-widget-edit--target' : '';
    return (
      <div data-widget-key={this.definition.key} onPointerDown={this.onPointerDown} className={`fc-widget-edit${state} ${this.span}`}>
        {this.renderBar()}
        <div className="fc-widget-edit__content" aria-hidden>
          {this.definition.render() ?? null}
        </div>
      </div>
    );
  }

  private renderBar(): ReactNode {
    const label = this.definition.label;
    return (
      <div className="fc-widget-edit__bar" title={AdminI18n.t('dashboard.widgets.dragHint')}>
        <FrameworkIcons.Grid size={14} />
        <span className="fc-widget-edit__name">{label}</span>
        {this.definition.source ? <Badge>{this.definition.source}</Badge> : null}
        {this.renderSizes()}
        {this.iconButton(<FrameworkIcons.ChevronUp size={14} />, AdminI18n.t('dashboard.widgets.moveEarlier', { label }), () => this.onShift(-1), this.isFirst)}
        {this.iconButton(<FrameworkIcons.ChevronDown size={14} />, AdminI18n.t('dashboard.widgets.moveLater', { label }), () => this.onShift(1), this.isLast)}
        {this.iconButton(<FrameworkIcons.Close size={14} />, AdminI18n.t('dashboard.widgets.remove', { label }), this.onRemove, false)}
      </div>
    );
  }

  /** The three widths, as the console's own small tabs. */
  private renderSizes(): ReactNode {
    const sizes = [DashboardWidgetSize.SMALL, DashboardWidgetSize.MEDIUM, DashboardWidgetSize.LARGE];
    return (
      <Tabs label={AdminI18n.t('dashboard.widgets.width')} value={String(this.size.value)}
        onChange={(key: string) => { const size = sizes.find((candidate) => String(candidate.value) === key); if (size) this.onResize(size); }}
        tabs={sizes.map((size) => ({ id: String(size.value), label: AdminI18n.t(`dashboard.widgets.sizeShort.${size.value}`) }))} />
    );
  }

  private iconButton(icon: ReactNode, label: string, onClick: () => void, disabled: boolean): ReactNode {
    return (
      <Button type="button" variant={ButtonVariant.GHOST} size={FieldSize.ICON} onClick={onClick} disabled={disabled} title={label} aria-label={label}>
        {icon}
      </Button>
    );
  }
}
