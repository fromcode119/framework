import type { ReactElement } from 'react';
import { Slot } from '@fromcode119/react';
import { CollectionListPage } from '@/components/collection/list/view/index.client';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { FulfilledThenable } from '@/lib/fulfilled-thenable';
import { PluginNotFound } from '@/components/plugins/view/plugin-not-found.client';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop, state } from '@fromcode119/reactor';

/**
 * Root route for a plugin.
 * Defaults to showing the collection that matches the plugin slug (primary collection).
 */
export class PluginRootRoute extends AdminComponent {
  @prop declare params: Promise<{ pluginSlug: string }>;

  @state pluginSlug = '';
  @state resolved = false;

  private mounted = false;

  /**
   * The params promise handed to `CollectionListPage`, created ONCE.
   *
   * It is consumed with React's `use()`, which suspends until the promise it was given settles. A promise
   * built inside `render()` is a NEW promise on every render attempt, so `use()` never sees the same one
   * resolve and the segment hangs on `loading.client.tsx` ("Hydrating Interface") forever — which is what
   * a plugin root with no page slot but a same-named collection (`/forms`) did.
   */
  private collectionParams?: PromiseLike<{ pluginSlug: string; slug: string }>;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.params;
    if (!this.mounted) return;
    this.pluginSlug = params.pluginSlug;
    this.collectionParams = new FulfilledThenable({ pluginSlug: params.pluginSlug, slug: params.pluginSlug });
    this.resolved = true;
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  render(): ReactElement {
    const { collections, slots, plugins, isReady } = this.runtime.plugins;
    const pluginSlug = this.pluginSlug;

    // Check if plugin is active
    const isActive = plugins.some((p: any) => p.slug === pluginSlug);

    const collection = AdminCollectionUtils.resolveCollection(collections as any, pluginSlug, pluginSlug);
    const pageSlot = `admin.plugin.${pluginSlug}.page.${pluginSlug}`;
    const hasPageSlot = !!(slots?.[pageSlot] && slots[pageSlot].length > 0);

    if (!this.resolved || !isReady) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader label="Synchronizing Module Context..." />
        </div>
      );
    }

    if (!isActive) {
      return <PluginNotFound pluginSlug={pluginSlug} />;
    }

    if (hasPageSlot || !collection) {
      return (
        <Slot
          name={pageSlot}
          fallback={<Slot name={`admin.plugin.${pluginSlug}.content`} />}
        />
      );
    }

    return <CollectionListPage params={this.collectionParams!} />;
  }
}
