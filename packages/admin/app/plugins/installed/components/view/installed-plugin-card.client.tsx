import type { ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Switch } from '@/components/ui/view/switch.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import { FrameworkIcons } from '@fromcode119/react';
import { Icon } from '@/components/view/icon.client';
import { PluginRegistryHealth } from '@fromcode119/core/client';
import { PluginHeldLabel } from '@/components/plugins/plugin-held-label';
import type { ILoadedPlugin } from '@fromcode119/core/client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { PluginSwitchState } from '@/app/plugins/installed/plugin-switch-state';
import { PluginListFilter } from '@/app/plugins/installed/enums/plugin-list-filter.enum';

/**
 * One installed plugin: its name and what it does, the version and author, its switch and a "⋯" menu
 * (settings, details, remove). Its look is the `fc-ext-row` rules of `settings.css`.
 *
 * Only what needs attention is marked beside the name — an update, a failure, a hold, being off on
 * this site. On or off is the switch's job, and where the code runs (isolated or shared) is on the
 * plugin's details page, not repeated on every row.
 */
export class InstalledPluginCard extends PureReactor {
  @prop declare hasImageError: boolean;
  @prop declare hasUpdate: boolean;
  @prop declare isDark: boolean;
  @prop declare onDelete: (slug: string) => void;
  @prop declare onImageError: (slug: string) => void;
  @prop declare onNavigate: (href: string) => void;
  @prop declare onToggle: (slug: string, currentEnabled: boolean, options?: { force?: boolean; recursive?: boolean }) => Promise<void>;
  @prop declare plugin: ILoadedPlugin;
  /** False for a tenant admin on a multi-tenant deployment: the switch and delete are not rendered. */
  @prop declare canManage: boolean;

  private get slug(): string {
    return this.plugin.manifest.slug;
  }

  private get author(): string {
    // What the manifest declares, and nothing when it declares nothing: a missing author is not an
    // endorsement, and "Official" printed beside a third-party package would read as one.
    const author = this.plugin.manifest.author as unknown;
    if (author && typeof author === 'object') return String((author as { name?: string }).name || '');
    return String(author || '');
  }

  private get menuItems(): IDropdownItem[] {
    const items: IDropdownItem[] = [
      { label: AdminI18n.t('plugins.list.settings'), icon: <FrameworkIcons.Settings size={14} />, onClick: () => this.onNavigate(AdminConstants.ROUTES.PLUGINS.SETTINGS_TAB(this.slug)) },
      { label: AdminI18n.t('plugins.list.details'), icon: <FrameworkIcons.Info size={14} />, onClick: () => this.onNavigate(AdminConstants.ROUTES.PLUGINS.DETAIL(this.slug)) },
    ];
    if (this.canManage) {
      items.push({ label: AdminI18n.t('plugins.list.remove'), icon: <FrameworkIcons.Trash size={14} />, variant: DropdownItemVariant.DANGER, onClick: () => this.onDelete(this.slug) });
    }
    return items;
  }

  private pills(): ReactNode[] {
    const { plugin } = this;
    const pill = AdminClass.of('ext-pill');
    const out: ReactNode[] = [];
    const isHeld = plugin.healthStatus === PluginRegistryHealth.WARNING || Boolean(plugin.heldReason);
    if (this.hasUpdate) {
      out.push(<AdminLink key="u" href={AdminConstants.ROUTES.PLUGINS.MARKETPLACE_DETAIL(this.slug)} className={`${pill} ${AdminClass.of('ext-pill--warn')}`}>{AdminI18n.t('plugins.list.update')}</AdminLink>);
    }
    if (PluginListFilter.failed(plugin)) {
      out.push(<span key="e" className={`${pill} ${AdminClass.of('ext-pill--danger')}`}>{AdminI18n.t('plugins.list.error')}</span>);
    } else if (plugin.healthStatus === PluginRegistryHealth.ERROR) {
      out.push(<span key="s" className={`${pill} ${AdminClass.of('ext-pill--danger')}`}>{AdminI18n.t('plugins.detail.security')}</span>);
    } else if (isHeld) {
      const added = (plugin.manifest.capabilities || []).filter((c) => !(plugin.approvedCapabilities || []).includes(c));
      const removed = (plugin.approvedCapabilities || []).filter((c) => !(plugin.manifest.capabilities || []).includes(c));
      const drift = [...added.map((c) => `+${c}`), ...removed.map((c) => `-${c}`)].join(' ');
      out.push(
        <span key="h" className={`${pill} ${AdminClass.of('ext-pill--warn')}`}
          title={drift ? AdminI18n.t('plugins.list.capabilityChangeSinceApproval2', { driftSummary: drift }) : undefined}>
          {PluginHeldLabel.of(plugin.heldReason)}{drift ? ` ${drift}` : ''}
        </span>,
      );
    } else if (new PluginSwitchState(plugin as any).notOnThisSite) {
      out.push(<span key="o" className={pill}>{AdminI18n.t('plugins.list.offHere')}</span>);
    }
    return out;
  }

  render(): ReactNode {
    const { canManage, hasImageError, onImageError, onToggle, plugin } = this;
    // TWO AXES on a deployment that can host sites — see PluginSwitchState. The switch shows the site's
    // answer when a site is bound and the platform's otherwise.
    const { perSite, switchedOn, locked } = new PluginSwitchState(plugin as any);
    const iconUrl = (plugin as any).iconUrl as string | undefined;
    const meta = [`v${plugin.manifest.version}`, this.author].filter(Boolean).join(' · ');

    return (
      <div className={AdminClass.of('ext-row')}>
        <div className={AdminClass.of('ext-row__icon')}>
          {/* A custom image only when one is genuinely declared; otherwise the manifest's own icon
              NAME rendered from the locally-bundled set — never fetched from a remote host. */}
          {iconUrl && !hasImageError
            ? <img src={iconUrl} alt="" onError={() => onImageError(this.slug)} />
            : <Icon name={String((plugin.manifest as any)?.admin?.icon || 'Box')} size={16} strokeWidth={1.5} />}
        </div>

        <div className={AdminClass.of('ext-row__text')}>
          <div className={AdminClass.of('ext-row__name')}>
            <AdminLink href={AdminConstants.ROUTES.PLUGINS.DETAIL(this.slug)}>{plugin.manifest.name}</AdminLink>
            {this.pills()}
          </div>
          <p className={`${AdminClass.of('ext-row__desc')}${plugin.error ? ` ${AdminClass.of('ext-row__desc--error')}` : ''}`} title={plugin.error || plugin.manifest.description || undefined}>
            {plugin.error ? plugin.error : (plugin.manifest.description || AdminI18n.t('plugins.list.defaultDescription', { name: plugin.manifest.name }))}
          </p>
        </div>

        <div className={AdminClass.of('ext-row__meta')} title={meta}>{meta}</div>

        <div className={AdminClass.of('ext-row__actions')}>
          {/* Not rendered for a tenant admin: enablement is an operator action, and a control that
              would only ever 403 is a bug, not a hint. Disabled when the platform axis blocks a
              per-site switch; the title says which axis is blocking. */}
          {canManage ? (
            <span title={locked
              ? AdminI18n.t('plugins.list.notAvailableOnThisPlatform')
              : perSite ? AdminI18n.t('plugins.list.runThisPluginOnThe') : undefined}>
              <Switch
                checked={switchedOn}
                disabled={locked}
                onChange={(_: boolean) => onToggle(this.slug, switchedOn)}
              />
            </span>
          ) : null}
          <Dropdown align={HorizontalAlign.RIGHT} items={this.menuItems} trigger={
            <span aria-label={AdminI18n.t('common.more')} className={AdminClass.of('ext-row__more')}>
              <FrameworkIcons.More size={16} />
            </span>
          } />
        </div>
      </div>
    );
  }
}
