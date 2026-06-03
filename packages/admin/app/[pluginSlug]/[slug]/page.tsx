"use client";

import React from 'react';
import { Slot } from '@fromcode119/react';
import CollectionListPage from '@/components/collection/list';
import { AdminCollectionUtils } from '@/lib/collection-utils';
import { CollectionNotFound } from '@/components/collection/collection-not-found';
import { PluginNotFound } from '@/components/plugins/plugin-not-found';
import { Loader } from '@/components/ui/loader';
import { AdminConstants } from '@/lib/constants';
import { AdminComponent } from '@/components/admin-component';
import type {
  CollectionListRouteProps,
  CollectionListRouteState,
} from './collection-list-route.interfaces';

export default class CollectionListRoute extends AdminComponent<CollectionListRouteProps, CollectionListRouteState> {
  private mounted = false;
  private prevShouldRedirect = false;

  state: CollectionListRouteState = {
    pluginSlug: '',
    slug: '',
    resolved: false,
  };

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.props.params;
    if (!this.mounted) return;
    this.setState({ pluginSlug: params.pluginSlug, slug: params.slug, resolved: true }, () => {
      this.maybeRedirect();
    });
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
      this.router.replace(AdminConstants.ROUTES.PLUGINS.SETTINGS_TAB(this.state.pluginSlug));
    }
    this.prevShouldRedirect = shouldRedirect;
  }

  private get resolvedPageSlot(): string | null {
    const { slots } = this.runtime.plugins;
    const { pluginSlug, slug } = this.state;
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
    const { pluginSlug, slug, resolved } = this.state;
    if (!resolved) return false;
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

  render(): React.ReactElement {
    const { isReady, plugins } = this.runtime.plugins;
    const { pluginSlug, slug, resolved } = this.state;

    if (!resolved || !isReady) {
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
      return <CollectionNotFound theme={this.theme === 'dark' ? 'dark' : 'light'} slug={slug} pluginSlug={pluginSlug} />;
    }

    return <CollectionListPage params={this.props.params} />;
  }
}
