import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import type { IAccountFileGroup } from '@react/account/interfaces/account-file-group.interface';
import type { IAccountFileSourceContext } from '@react/account/interfaces/account-file-source-context.interface';
import type { IAccountFileSource } from '@react/account/interfaces/account-file-source.interface';

/**
 * Collects every plugin that has files for the signed-in user, from the `account.files.sources` slot.
 *
 * The account grew a panel per owner — one plugin's "Materials", another's "Downloads", framework shares — which
 * left a person hunting for one file with three places to look. `AccountSectionRegistry` cannot fix
 * that: a duplicate section key makes both panels render. So plugins contribute DATA here instead, the
 * same way they contribute stat cards to `account.overview.stats`.
 *
 * A contributor is a class with `static fileSource = { key, priority, labelKey }` and
 * `static async loadFiles(context)`. The framework names no plugin: a source exists because its plugin
 * registered one, and disappears with the plugin.
 */
export class AccountFileSourceRegistry {
  static readonly SLOT = 'account.files.sources';

  /** Contributors in render order — priority, then key so ties are stable rather than slot-ordered. */
  static sorted(contributors: ISlotComponent[] | undefined): ISlotComponent[] {
    return [...(contributors || [])].sort((a, b) => {
      const left = AccountFileSourceRegistry.descriptorOf(a);
      const right = AccountFileSourceRegistry.descriptorOf(b);
      return (left.priority ?? 100) - (right.priority ?? 100) || String(left.key).localeCompare(String(right.key));
    });
  }

  static descriptorOf(entry: ISlotComponent): { key: string; priority?: number; labelKey?: string } {
    return ((entry?.component as any)?.fileSource) || { key: String(entry?.pluginSlug || 'source') };
  }

  /**
   * Load every source concurrently, keeping whatever succeeds.
   *
   * One failing plugin must not blank the panel: if one source is down, a person should still see the files
   * someone emailed them. A rejected source contributes nothing and is reported by key, so the panel
   * can say something is missing rather than silently showing a shorter list.
   */
  static async loadAll(
    contributors: ISlotComponent[] | undefined,
    context: IAccountFileSourceContext,
  ): Promise<{ blocks: Array<{ key: string; label: string; groups: IAccountFileGroup[] }>; failedKeys: string[] }> {
    const sources = AccountFileSourceRegistry.sorted(contributors);

    const settled = await Promise.allSettled(
      sources.map(async (entry) => {
        const loader = (entry?.component as Partial<IAccountFileSource> | undefined)?.loadFiles;
        // Not a defensive contract check: this slot accepts whatever a plugin registers, so a component
        // that is not a file source at all can legitimately land here.
        if (typeof loader !== 'function') return [] as IAccountFileGroup[];
        return (await loader(context)) as IAccountFileGroup[];
      }),
    );

    const blocks: Array<{ key: string; label: string; groups: IAccountFileGroup[] }> = [];
    const failedKeys: string[] = [];

    settled.forEach((result, index) => {
      const descriptor = AccountFileSourceRegistry.descriptorOf(sources[index]);
      if (result.status === 'rejected') {
        failedKeys.push(descriptor.key);
        return;
      }

      const groups = (result.value || []).filter((group) => group && (group.files || []).length > 0);
      if (!groups.length) return;

      blocks.push({
        key: descriptor.key,
        // The plugin's own translated heading; the framework has no copy for someone else's domain.
        label: descriptor.labelKey ? context.t(descriptor.labelKey) : descriptor.key,
        groups,
      });
    });

    return { blocks, failedKeys };
  }
}
