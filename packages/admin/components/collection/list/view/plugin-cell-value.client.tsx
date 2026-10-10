import type { ReactNode } from 'react';
import { PluginComponent } from '@fromcode119/react';
import { CustomFieldErrorBoundary } from '@/components/collection/custom-field-error-boundary';

/**
 * A list value drawn by the component its field names in `admin.cell` — a price in its currency, which
 * only the plugin that owns money can format. Looked up in the same registry as a field's editing
 * `component`. Until the plugin's UI has registered it, or if the component throws, the plain value
 * the list would otherwise show is drawn instead, so a cell is never empty because of a plugin.
 */
export class PluginCellValue extends PluginComponent {
  declare props: { componentName: string; value: unknown; row: Record<string, unknown>; field: unknown; fallback: ReactNode };

  private get component(): any {
    const registered = ((this.plugins as any).fieldComponents || {})[this.props.componentName];
    if (registered && typeof registered === 'object' && !registered.$$typeof) {
      return registered.component || registered.Component || registered.render || registered.default || null;
    }
    return registered || null;
  }

  render(): ReactNode {
    const Component = this.component;
    if (!Component) return this.props.fallback;
    return (
      <CustomFieldErrorBoundary componentName={this.props.componentName}>
        <Component value={this.props.value} row={this.props.row} field={this.props.field} />
      </CustomFieldErrorBoundary>
    );
  }
}
