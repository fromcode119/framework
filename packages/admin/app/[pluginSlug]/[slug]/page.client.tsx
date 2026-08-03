import { ThemeMode } from '@fromcode119/core/client';
import type { ReactElement } from 'react';
import { Slot } from '@fromcode119/react';
import { CollectionListPage } from '@/components/collection/list/view/index.client';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { CollectionNotFound } from '@/components/collection/view/collection-not-found.client';
import { PluginNotFound } from '@/components/plugins/view/plugin-not-found.client';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop, state } from '@fromcode119/reactor';

export class CollectionListRoute extends AdminComponent {
  @prop declare params: Promise<{ pluginSlug: string; slug: string }>;

  @state pluginSlug = '';
  @state slug = '';
  @state resolved = false;

  private mounted = false;
  private prevShouldRedirect = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.params;
    if (!this.mounted) return;
    this.pluginSlug = params.pluginSlug;
    this.slug = params.slug;
    this.resolved = true;
    this.maybeRedirect();
  }

  componentDidUpdate(): void {
    this.maybeRedirect();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private maybeRedirect(): void {
    const shouldRedirect = this.shouldRedirectToPluginSettings;
    if (shouldRedirect && !this.prevShouldRedirect) {
      this.router.replace(AdminConstants.ROUTES.PLUGINS.SETTINGS_TAB(this.pluginSlug));
    }
    this.prevShouldRedirect = shouldRedirect;
  }

  private get resolvedPageSlot(): string | null {
    const { slots } = this.runtime.plugins;
    const pluginSlug = this.pluginSlug;
    const slug = this.slug;
    // Plugins register sub-page slots as `admin.plugin.<plugin>.<slug>` (the simple convention).
    // The verbose `…page.<plugin>.<slug>` form is also accepted for backward compatibility.
    const verbosePageSlot = `admin.plugin.${pluginSlug}.page.${pluginSlug}.${slug}`;
    const directPageSlot = `admin.plugin.${pluginSlug}.${slug}`;
    return (slots?.[verbosePageSlot] && slots[verbosePageSlot].length > 0)
      ? verbosePageSlot
      : (slots?.[directPageSlot] && slots[directPageSlot].length > 0)
        ? directPageSlot
        : null;
  }

  private get shouldRedirectToPluginSettings(): boolean {
    const { isReady, plugins } = this.runtime.plugins;
    const pluginSlug = this.pluginSlug;
    const slug = this.slug;
    if (!this.resolved) return false;
    const collection = AdminCollectionUtils.resolveCollection(this.collectionsList as any, pluginSlug, slug);
    const activePlugin = plugins.find((plugin: any) => plugin.slug === pluginSlug);
    const verbosePageSlot = `admin.plugin.${pluginSlug}.page.${pluginSlug}.${slug}`;
    const directPageSlot = `admin.plugin.${pluginSlug}.${slug}`;
    const hasPageSlot = !!this.resolvedPageSlot;
    const hasDeclaredPageSlot = Boolean(activePlugin?.admin?.slots?.some(
      (entry: any) => entry?.slot === verbosePageSlot || entry?.slot === directPageSlot,
    ));
    return isReady && !hasPageSlot && !hasDeclaredPageSlot && !collection && slug === 'settings';
  }

  private get collectionsList(): any[] {
    return this.runtime.plugins.collections as any;
  }

  render(): ReactElement {
    const { isReady, plugins } = this.runtime.plugins;
    const pluginSlug = this.pluginSlug;
    const slug = this.slug;

    if (!this.resolved || !isReady) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader label="Synchronizing Module Context..." />
        </div>
      );
    }

    const isActive = plugins.some((p: any) => p.slug === pluginSlug);
    if (!isActive) {
      return <PluginNotFound pluginSlug={pluginSlug} />;
    }

    const resolvedPageSlot = this.resolvedPageSlot;
    const hasPageSlot = !!resolvedPageSlot;

    if (hasPageSlot && resolvedPageSlot) {
      return (
        <Slot
          name={resolvedPageSlot}
          fallback={<Slot name={`admin.plugin.${pluginSlug}.content`} />}
        />
      );
    }

    const activePlugin = plugins.find((plugin: any) => plugin.slug === pluginSlug);
    const verbosePageSlot = `admin.plugin.${pluginSlug}.page.${pluginSlug}.${slug}`;
    const directPageSlot = `admin.plugin.${pluginSlug}.${slug}`;
    const hasDeclaredPageSlot = Boolean(activePlugin?.admin?.slots?.some(
      (entry: any) => entry?.slot === verbosePageSlot || entry?.slot === directPageSlot,
    ));

    // Manifest declares the slot but the plugin bundle hasn't finished registering its
    // components yet. Show a spinner instead of flashing CollectionNotFound.
    if (hasDeclaredPageSlot) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader />
        </div>
      );
    }

    const collection = AdminCollectionUtils.resolveCollection(this.collectionsList as any, pluginSlug, slug);
    if (!collection) {
      if (this.shouldRedirectToPluginSettings) {
        return (
          <div className="flex h-[60vh] items-center justify-center">
            <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        );
      }
      return <CollectionNotFound theme={this.theme === ThemeMode.DARK ? 'dark' : 'light'} slug={slug} pluginSlug={pluginSlug} />;
    }

    return <CollectionListPage params={this.params} />;
  }
}
