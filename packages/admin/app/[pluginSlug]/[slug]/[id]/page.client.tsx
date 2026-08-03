import type { ReactElement } from 'react';
import { Slot } from '@fromcode119/react';
import { CollectionEditPage } from '@/components/collection/view/collection-edit-page.client';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop, state } from '@fromcode119/reactor';

export class CollectionEditRoute extends AdminComponent {
  @prop declare params: Promise<{ pluginSlug: string; slug: string; id: string }>;

  @state pluginSlug = '';
  @state slug = '';
  @state id = '';
  @state resolved = false;

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.params;
    if (!this.mounted) return;
    this.pluginSlug = params.pluginSlug;
    this.slug = params.slug;
    this.id = params.id;
    this.resolved = true;
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private get detailSlot(): string {
    return `admin.plugin.${this.pluginSlug}.page.${this.pluginSlug}.${this.slug}.detail`;
  }

  private get hasDetailSlot(): boolean {
    const { slots } = this.runtime.plugins;
    const detailSlot = this.detailSlot;
    return !!(slots?.[detailSlot] && slots[detailSlot].length > 0);
  }

  private get hasDeclaredDetailSlot(): boolean {
    const { plugins } = this.runtime.plugins;
    const activePlugin = plugins.find((p: any) => p.slug === this.pluginSlug);
    return Boolean(
      activePlugin?.admin?.slots?.some((entry: any) => entry?.slot === this.detailSlot),
    );
  }

  render(): ReactElement {
    const { isReady } = this.runtime.plugins;

    if (!this.resolved || !isReady) {
      return <div className="flex-1 flex items-center justify-center"><Loader /></div>;
    }

    if (this.hasDetailSlot) {
      return <Slot name={this.detailSlot} props={{ id: this.id, pluginSlug: this.pluginSlug, entitySlug: this.slug }} />;
    }

    // Manifest declares the slot but the bundle hasn't yet registered its component.
    if (this.hasDeclaredDetailSlot) {
      return <div className="flex-1 flex items-center justify-center"><Loader /></div>;
    }

    return <CollectionEditPage params={this.params} />;
  }
}
