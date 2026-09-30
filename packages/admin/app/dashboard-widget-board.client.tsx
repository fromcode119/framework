import type { PointerEvent, ReactElement, ReactNode } from 'react';
import { prop, state } from '@fromcode119/react-class-components';
import { DashboardWidgetSize } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { Button } from '@/components/ui/view/button.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { DashboardLayout } from '@/lib/dashboard/dashboard-layout';
import { DashboardLayoutStore } from '@/lib/dashboard/dashboard-layout-store';
import { DashboardPluginWidgets } from '@/lib/dashboard/dashboard-plugin-widgets';
import { DashboardPointerDrag } from '@/lib/dashboard/dashboard-pointer-drag';
import { DashboardWidgetFrame } from '@/app/dashboard-widget-frame.client';
import { DashboardWidgetPicker } from '@/app/dashboard-widget-picker.client';
import type { IDashboardLayoutEntry } from '@/lib/dashboard/interfaces/dashboard-layout-entry.interface';
import type { IDashboardWidgetDefinition } from '@/lib/dashboard/interfaces/dashboard-widget-definition.interface';

/**
 * The dashboard's widgets, arranged by the person looking at it.
 *
 * The console's own panels and every widget an active plugin declares are offered alike. Each person
 * keeps their own arrangement (saved to their UI preferences on every change); someone who has never
 * arranged theirs sees each widget's default. Nothing here is fixed in place: every widget can be moved,
 * resized or removed, and put back from "Add widget".
 */
export class DashboardWidgetBoard extends AdminComponent {
  @prop declare systemWidgets: IDashboardWidgetDefinition[];

  @state private saved: IDashboardLayoutEntry[] | null = null;
  @state private loaded = false;
  @state private editing = false;
  @state private dragKey = '';
  @state private overKey = '';
  @state private saveFailed = false;

  private mounted = false;
  /** The layout a drag reorders — the one on screen when it started. */
  private dragLayout: IDashboardLayoutEntry[] = [];
  private readonly drag = new DashboardPointerDrag(
    (dragKey, overKey) => { if (this.mounted) { this.dragKey = dragKey; this.overKey = overKey; } },
    (dragKey, overKey) => this.commit(DashboardLayout.move(this.dragLayout, dragKey, overKey)),
  );

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const saved = await DashboardLayoutStore.load().catch(() => null);
    if (!this.mounted) return;
    this.saved = saved;
    this.loaded = true;
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private get definitions(): IDashboardWidgetDefinition[] {
    const plugins = this.runtime.plugins;
    return [...(this.systemWidgets || []), ...DashboardPluginWidgets.definitions(plugins?.plugins ?? [], Boolean(plugins?.isReady), this.auth.user)];
  }

  private get layout(): IDashboardLayoutEntry[] {
    return DashboardLayout.resolve(this.definitions, this.saved);
  }

  private commit(next: IDashboardLayoutEntry[]): void {
    this.saved = next;
    this.saveFailed = false;
    DashboardLayoutStore.save(next).catch(() => { if (this.mounted) this.saveFailed = true; });
  }

  private reset(): void {
    this.saved = null;
    this.saveFailed = false;
    DashboardLayoutStore.reset().catch(() => { if (this.mounted) this.saveFailed = true; });
  }

  render(): ReactElement {
    const definitions = this.definitions;
    const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
    const layout = this.layout;
    return (
      <div className="space-y-4">
        {this.renderToolbar()}
        {this.editing ? <DashboardWidgetPicker available={DashboardLayout.available(definitions, layout)} onAdd={(definition: IDashboardWidgetDefinition) => this.commit(DashboardLayout.add(layout, definition))} /> : null}
        {this.loaded && layout.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-[13px] text-slate-500 dark:border-slate-800">{AdminI18n.t('dashboard.widgets.empty')}</p>
        ) : null}
        <div className="grid grid-flow-row-dense grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
          {this.loaded ? layout.map((entry, index) => this.renderWidget(entry, index, layout, byKey.get(entry.key)!)) : null}
        </div>
      </div>
    );
  }

  private renderWidget(entry: IDashboardLayoutEntry, index: number, layout: IDashboardLayoutEntry[], definition: IDashboardWidgetDefinition): ReactNode {
    return (
      <DashboardWidgetFrame
        key={entry.key}
        definition={definition}
        size={DashboardWidgetSize.resolve(entry.size)}
        editing={this.editing}
        dragging={this.dragKey === entry.key}
        isFirst={index === 0}
        isLast={index === layout.length - 1}
        onRemove={() => this.commit(DashboardLayout.remove(layout, entry.key))}
        onResize={(size: DashboardWidgetSize) => this.commit(DashboardLayout.resize(layout, entry.key, size))}
        onShift={(step: number) => this.commit(DashboardLayout.shift(layout, entry.key, step))}
        dropTarget={this.overKey === entry.key}
        onPointerDown={(event: PointerEvent) => { this.dragLayout = layout; this.drag.start(entry.key, event); }}
      />
    );
  }

  private renderToolbar(): ReactNode {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {this.saveFailed ? <span className="mr-auto text-[12px] text-rose-600">{AdminI18n.t('dashboard.widgets.saveFailed')}</span> : null}
        {this.editing ? (
          <>
            <span className="mr-auto text-[12px] text-slate-500">{AdminI18n.t('dashboard.widgets.editHint')}</span>
            <Button size={FieldSize.SM} variant={ButtonVariant.GHOST} onClick={() => this.reset()}>
              <FrameworkIcons.Refresh size={14} /> {AdminI18n.t('dashboard.widgets.reset')}
            </Button>
            <Button size={FieldSize.SM} onClick={() => { this.editing = false; }}>
              <FrameworkIcons.Check size={14} /> {AdminI18n.t('dashboard.widgets.done')}
            </Button>
          </>
        ) : (
          <Button size={FieldSize.SM} variant={ButtonVariant.SECONDARY} onClick={() => { this.editing = true; }}>
            <FrameworkIcons.LayoutDashboard size={14} /> {AdminI18n.t('dashboard.widgets.customize')}
          </Button>
        )}
      </div>
    );
  }
}
