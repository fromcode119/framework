import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { PluginState } from '@fromcode119/core/client';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { StructuredReadOnlyField } from '@/components/collection/fields/view/structured-read-only-field.client';
import { PluginDefinitionFacts } from '@/app/plugins/[slug]/plugin-definition-facts';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The plugin's definition, for the platform: what its manifest declares, at a glance, then the whole
 * manifest as the admin's own read-only tree (the same renderer every recorded JSON value uses, with its
 * copy button) in place of a wall of raw JSON.
 *
 * Rendered into `document.body` through `portal`: in place it was a child of the page's `space-y-6`
 * column, whose `margin-top` on every later child pushed this `fixed inset-0` overlay 24px down — a
 * white band above the backdrop.
 */
export class PluginManifestModal extends AdminComponent {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare plugin: ILoadedPlugin;

  private section(title: string, body: ReactNode): ReactNode {
    return (
      <section>
        <h4 className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</h4>
        {body}
      </section>
    );
  }

  private get capabilities(): ReactNode {
    const rows = PluginDefinitionFacts.capabilities(this.plugin);
    if (!rows.length) return null;
    return this.section(
      AdminI18n.t('plugins.detail.definition.capabilities'),
      <div className="flex flex-wrap gap-1.5">
        {rows.map((row) => (
          <Badge key={row.name} variant={row.approved ? BadgeVariant.SUCCESS : BadgeVariant.WARNING}>
            {row.name}
            {row.approved ? '' : ` (${AdminI18n.t('plugins.detail.definition.notApproved')})`}
          </Badge>
        ))}
      </div>,
    );
  }

  /** Green while it runs, red when it failed to start, grey for everything in between. */
  private get stateVariant(): BadgeVariant {
    const state = PluginState.resolve(this.plugin.state);
    if (state === PluginState.ACTIVE) return BadgeVariant.SUCCESS;
    return state === PluginState.ERROR ? BadgeVariant.DANGER : BadgeVariant.DEFAULT;
  }

  private facts(title: string, facts: ReturnType<typeof PluginDefinitionFacts.identity>, lock: string): ReactNode {
    return facts.length ? this.section(title, <AdminFactGrid facts={facts} lockLabel={lock} />) : null;
  }

  render(): ReactNode {
    const { isOpen, onClose, plugin } = this;
    if (!isOpen) return null;
    const manifest = plugin.manifest;
    const declared = AdminI18n.t('plugins.detail.definition.declared');

    return this.portal(
      <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-md sm:p-6" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-labelledby="plugin-definition-title"
          className={`relative my-auto flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden ${AdminClass.SURFACE}`} onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
            <div className="flex-shrink-0 rounded-lg bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <FrameworkIcons.Package size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="plugin-definition-title" className="break-words text-lg font-bold tracking-tight text-slate-900 dark:text-white">{manifest.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {AdminI18n.t('plugins.detail.definition.subtitle', { slug: manifest.slug, version: manifest.version })}
                </p>
                <Badge variant={this.stateVariant}>{PluginState.resolve(plugin.state).value}</Badge>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label={AdminI18n.t('common.close')}
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-white">
              <FrameworkIcons.Close size={20} />
            </button>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            {this.facts(AdminI18n.t('plugins.detail.definition.identity'), [...PluginDefinitionFacts.identity(plugin), ...PluginDefinitionFacts.reach(plugin)], declared)}
            {this.capabilities}
            {this.facts(AdminI18n.t('plugins.detail.definition.error'), PluginDefinitionFacts.runtime(plugin), AdminI18n.t('plugins.detail.definition.recorded'))}
            {this.section(AdminI18n.t('plugins.detail.definition.manifest'), <StructuredReadOnlyField value={manifest} theme={this.theme} />)}
          </div>
        </div>
      </div>
    );
  }
}
