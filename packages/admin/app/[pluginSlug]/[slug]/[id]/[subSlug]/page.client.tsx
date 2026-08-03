import type { ReactElement } from 'react';
import { Slot } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop, state } from '@fromcode119/reactor';

/**
 * Nested entity page — e.g. /numerology/profiles/3/readings, /mlm/affiliates/3/hub.
 * Resolves to slot `admin.plugin.<plugin>.page.<plugin>.<slug>.<subSlug>` with `id`
 * passed as a prop.
 *
 * IMPORTANT: this ALWAYS renders the `<Slot>` (with a Loader fallback) instead of
 * returning a standalone `<Loader>` while `!isReady` and then swapping to `<Slot>`.
 * That swap changed the root element type (div → Slot), so React tore down the loader
 * subtree and mounted the slot child FRESH the moment `isReady` flipped true — a visible
 * flash on every nested plugin page. Keeping the Slot as the stable root (keyed by slot
 * name) mounts the page exactly once. (The standard collection route never flashed for
 * the same reason — it never swapped its root.)
 */
export class NestedEntityRoute extends AdminComponent {
  @prop declare params: Promise<{ pluginSlug: string; slug: string; id: string; subSlug: string }>;

  @state pluginSlug = '';
  @state slug = '';
  @state id = '';
  @state subSlug = '';
  @state resolved = false;

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.params;
    if (!this.mounted) return;
    this.pluginSlug = params.pluginSlug;
    this.slug = params.slug;
    this.id = params.id;
    this.subSlug = params.subSlug;
    this.resolved = true;
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private get slotName(): string {
    return `admin.plugin.${this.pluginSlug}.page.${this.pluginSlug}.${this.slug}.${this.subSlug}`;
  }

  private get hasSlot(): boolean {
    const { slots } = this.runtime.plugins;
    const slotName = this.slotName;
    return !!(slots?.[slotName] && slots[slotName].length > 0);
  }

  private get hasDeclaredSlot(): boolean {
    const { plugins } = this.runtime.plugins;
    const activePlugin = plugins.find((p: any) => p.slug === this.pluginSlug);
    const slotName = this.slotName;
    return Boolean(
      activePlugin?.admin?.slots?.some((entry: any) => entry?.slot === slotName),
    );
  }

  render(): ReactElement {
    const { isReady } = this.runtime.plugins;
    const loader = <div className="flex-1 flex items-center justify-center"><Loader /></div>;

    if (!this.resolved) return loader;

    const slotName = this.slotName;

    // Only once the registry is ready AND the slot is genuinely absent do we show the
    // "not registered" notice. While loading, the Slot below renders its Loader fallback.
    if (isReady && !this.hasSlot && !this.hasDeclaredSlot) {
      return (
        <div className="p-8">
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 text-sm">
            No slot registered for <code className="font-mono">{slotName}</code>.
          </div>
        </div>
      );
    }

    return (
      <Slot
        key={slotName}
        name={slotName}
        props={{ id: this.id, pluginSlug: this.pluginSlug, entitySlug: this.slug, subSlug: this.subSlug }}
        fallback={loader}
      />
    );
  }
}
