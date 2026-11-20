import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop } from '@fromcode119/react-class-components';
import { PluginState } from '@fromcode119/core/client';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { StructuredReadOnlyField } from '@/components/collection/fields/view/structured-read-only-field.client';
import { PluginDefinitionFacts } from '@/app/plugins/[slug]/plugin-definition-facts';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The plugin's definition, for the platform: what its manifest declares, at a glance, then the whole
 * manifest as the admin's own read-only tree (the same renderer every recorded JSON value uses, with its
 * copy button) in place of a wall of raw JSON.
 *
 * In the console's side drawer, which portals itself onto `body`.
 */
export class PluginManifestModal extends AdminComponent {
  @prop declare isOpen: boolean;
  @prop declare onClose: () => void;
  @prop declare plugin: ILoadedPlugin;

  private section(title: string, body: ReactNode): ReactNode {
    return (
      <section className="fc-field-stack">
        <h3 className="fc-field-label">{title}</h3>
        {body}
      </section>
    );
  }

  private get capabilities(): ReactNode {
    const rows = PluginDefinitionFacts.capabilities(this.plugin);
    if (!rows.length) return null;
    return this.section(
      AdminI18n.t('plugins.detail.definition.capabilities'),
      <div className="fc-chip-row">
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
    const manifest = plugin.manifest;
    const declared = AdminI18n.t('plugins.detail.definition.declared');

    // The console's side drawer, read-only: the state beside the slug and version, the facts, the tree.
    return (
      <EditSheet
        isOpen={isOpen}
        title={manifest.name}
        subtitle={(
          <span className="fc-chip-row">
            <span>{AdminI18n.t('plugins.detail.definition.subtitle', { slug: manifest.slug, version: manifest.version })}</span>
            <Badge variant={this.stateVariant}>{PluginState.resolve(plugin.state).value}</Badge>
          </span>
        )}
        onClose={onClose}
        foot={<Button variant={ButtonVariant.SECONDARY} onClick={onClose}>{AdminI18n.t('common.close')}</Button>}
      >
        <div className="fc-form-stack">
          {this.facts(AdminI18n.t('plugins.detail.definition.identity'), [...PluginDefinitionFacts.identity(plugin), ...PluginDefinitionFacts.reach(plugin)], declared)}
          {this.capabilities}
          {this.facts(AdminI18n.t('plugins.detail.definition.error'), PluginDefinitionFacts.runtime(plugin), AdminI18n.t('plugins.detail.definition.recorded'))}
          {this.section(AdminI18n.t('plugins.detail.definition.manifest'), <StructuredReadOnlyField value={manifest} theme={this.theme} />)}
        </div>
      </EditSheet>
    );
  }
}
