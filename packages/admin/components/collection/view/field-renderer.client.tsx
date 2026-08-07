import type { ReactElement } from 'react';
import { PluginComponent } from '@fromcode119/react';
import { AdminCollectionUtils } from '@/lib/collection-utils';
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

  /**
   * Which plugin owns the collection being edited — needed to link a field's provenance line to the
   * settings screen that actually holds the inherited value. Resolved here rather than threaded as a
   * prop through four layers of edit-page components, because this shim already has the registry.
   * `'collections'` is the global-route form of the lookup: match on slug alone, any owner.
   */
  private get owningPluginSlug(): string {
    const collection = AdminCollectionUtils.resolveCollection(
      (this.collections || []) as any,
      'collections',
      this.props.collectionSlug,
    );
    return String((collection as any)?.pluginSlug || '');
  }

  render(): ReactElement {
    return (
      <FieldRendererView
        {...this.props}
        plugins={this.plugins}
        globalSettings={this.globalSettings}
        pluginSlug={this.owningPluginSlug}
      />
    );
  }
}
