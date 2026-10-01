import type { ComponentType, ReactNode } from 'react';
import { Reactor } from '@fromcode119/react-class-components';
import { SlotsContext } from '@react/context/slots-context';
import { PluginUsageTracker } from '@react/plugin-usage-tracker';
import { PluginMountErrorBoundary } from '@react/view/plugin-mount-error-boundary';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import type { ISlotProps } from '@react/interfaces/slot-props.interface';
import { CoercionUtils } from '@fromcode119/core/client';
import { PluginContextRegistry } from '@react/plugin-context';
import { PluginWidgetHost } from '@react/widgets/plugin-widget-host';
import { PluginWidgetFrame } from '@react/widgets/plugin-widget-frame';

export class Slot extends Reactor {
  declare props: Pick<ISlotProps, keyof ISlotProps>;
  render(): ReactNode {
    return (
      <SlotsContext.Context.Consumer>
        {(slots) => (
          <PluginWidgetHost.Context.Consumer>
            {(widgetHost) => (
              <PluginContextRegistry.Context.Consumer>
                {(context) => {
                  const registered = slots[this.props.name] || [];
                  const include = this.props.include;
                  const components = include ? registered.filter((item) => include({ pluginSlug: String(item?.pluginSlug ?? '') })) : registered;
                  const widgets = widgetHost ? Slot.widgetsFor(this.props.name, context?.plugins, include) : [];
                  if (components.length === 0 && widgets.length === 0) return <>{this.props.fallback}</>;
                  return (
                    <>
                      {components.map((item, index) => this.renderSlotComponent(item, index))}
                      {widgets.map((widget, index) => <PluginWidgetFrame key={`widget-${widget.pluginSlug}-${index}`} {...widget} />)}
                    </>
                  );
                }}
              </PluginContextRegistry.Context.Consumer>
            )}
          </PluginWidgetHost.Context.Consumer>
        )}
      </SlotsContext.Context.Consumer>
    );
  }

  /**
   * The widgets plugins placed in this slot (`ui.widgets`), in plugin order then manifest order. Read
   * from the plugin descriptors both the server render and the browser hold, so both render the same
   * frames. Not recorded as plugin usage: a widget loads no plugin bundle into the page.
   */
  static widgetsFor(slot: string, plugins: unknown, include?: ISlotProps['include']): Array<{ pluginSlug: string; path: string; height?: number; title?: string }> {
    const list = Array.isArray(plugins) ? plugins : [];
    return list.flatMap((entry) => {
      const plugin = CoercionUtils.toObject(entry);
      const pluginSlug = CoercionUtils.toString(plugin.slug);
      if (!pluginSlug || (include && !include({ pluginSlug }))) return [];
      const declared = CoercionUtils.toObject(plugin.ui).widgets;
      const widgets: unknown[] = Array.isArray(declared) ? declared : [];
      return widgets
        .map((widget) => CoercionUtils.toObject(widget))
        .filter((widget) => CoercionUtils.toString(widget.slot) === slot && CoercionUtils.toString(widget.path).startsWith('/'))
        .map((widget) => ({
          pluginSlug,
          path: CoercionUtils.toString(widget.path),
          height: CoercionUtils.toNumber(widget.height) || undefined,
          title: CoercionUtils.toString(widget.title) || undefined,
        }));
    });
  }

  private renderSlotComponent(item: ISlotComponent, index: number): ReactNode {
    if (!item?.component) {
      console.warn(`[Slot] Requested component for slot "${this.props.name}" is undefined. Plugin: ${item?.pluginSlug || 'unknown'}`);
      return null;
    }

    if (!Slot.isValidComponent(item.component)) {
      console.warn(`[Slot] Component for slot "${this.props.name}" is of invalid type: ${typeof item.component}. Skipping.`);
      return null;
    }

    try {
      const componentName = (item.component as any)?.displayName || (item.component as any)?.name || `c${index}`;
      const Component = item.component as ComponentType<any>;
      PluginUsageTracker.record(item.pluginSlug);
      return (
        <PluginMountErrorBoundary
          slotName={this.props.name}
          pluginSlug={item.pluginSlug}
          componentName={componentName}
          renderFallback={this.props.errorFallback}
          key={`${item.pluginSlug}-${componentName}-${index}`}
        >
          <Component {...this.props.props} />
        </PluginMountErrorBoundary>
      );
    } catch (error) {
      console.error(`[Slot] Runtime error in slot component "${this.props.name}":`, error);
      return null;
    }
  }

  private static isValidComponent(component: any): boolean {
    return typeof component === 'function' || typeof component === 'string' || Boolean(component?.$$typeof);
  }
}
