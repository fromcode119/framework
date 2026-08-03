import type { ReactElement } from 'react';
import { Slot } from '@fromcode119/react';
import { CollectionEditPage } from '@/components/collection/view/collection-edit-page.client';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop, state } from '@fromcode119/reactor';

export class CollectionEditSubRoute extends AdminComponent {
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

  private get editSlot(): string {
    return `admin.plugin.${this.pluginSlug}.page.${this.pluginSlug}.${this.slug}.edit`;
  }

  render(): ReactElement {
    const { slots, plugins, isReady } = this.runtime.plugins;
    const pluginSlug = this.pluginSlug;
    const slug = this.slug;
    const id = this.id;

    const editSlot = this.editSlot;
    const activePlugin = plugins.find((p: any) => p.slug === pluginSlug);
    const hasEditSlot = !!(slots?.[editSlot] && slots[editSlot].length > 0);
    const hasDeclaredEditSlot = Boolean(
      activePlugin?.admin?.slots?.some((entry: any) => entry?.slot === editSlot),
    );

    if (!this.resolved || !isReady) {
      return <div className="flex-1 flex items-center justify-center"><Loader /></div>;
    }

    if (hasEditSlot) {
      return <Slot name={editSlot} props={{ id, pluginSlug, entitySlug: slug }} />;
    }

    // Manifest declares the slot but the bundle hasn't yet registered its component.
    if (hasDeclaredEditSlot) {
      return <div className="flex-1 flex items-center justify-center"><Loader /></div>;
    }

    return <CollectionEditPage params={this.params} />;
  }
}
