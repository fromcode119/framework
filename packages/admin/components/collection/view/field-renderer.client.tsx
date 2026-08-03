import type { ReactElement } from 'react';
import { PluginComponent } from '@fromcode119/react';
import { FieldRendererView } from '@/components/collection/field-renderer-view';
import type { IFieldRendererProps } from '@/components/collection/interfaces/field-renderer-props.interface';

/**
 * Thin shim — reads the plugin registry and system-wide settings from {@link PluginRuntimeContext}
 * (via {@link PluginComponent}) and hands them to the hook-free {@link FieldRendererView} class,
 * which holds the locale-menu state, ref, and effects.
 *
 * `globalSettings` (timezone, measurement system, …) is threaded to custom field components so a
 * field can read platform config (e.g. metric/imperial) without re-fetching or relying on a global.
 */
export class FieldRenderer extends PluginComponent {
  declare props: Pick<IFieldRendererProps, keyof IFieldRendererProps>;
  render(): ReactElement {
    return <FieldRendererView {...this.props} plugins={this.plugins} globalSettings={this.globalSettings} />;
  }
}
