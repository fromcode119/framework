import type { ReactElement } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { TenantOption } from '@/lib/tenants/tenant-option';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminPathUtils } from '@/lib/admin-path';

/**
 * The list behind the site switcher: where you can go, and where you are.
 *
 * Split out of `TenantSwitcher` so the trigger keeps the popover behaviour (focus, Escape, outside
 * click, the workspace mode question) and this holds only what is being chosen between.
 */
export class TenantSwitcherMenu extends PureReactor {
  declare props: Pick<TenantSwitcherMenu, 'tenants' | 'current' | 'canManagePlatform' | 'onSelect' | 'onAskMode' | 'onLeave'>;

  @prop declare tenants: TenantOption[];
  @prop declare current: string | null;
  /** Platform admins only: the Platform row, and the link to the Sites registry. */
  @prop declare canManagePlatform: boolean;
  @prop declare onSelect: (tenant: TenantOption) => void;
  @prop declare onAskMode: (tenant: TenantOption) => void;
  @prop declare onLeave: () => void;

  /**
   * Standing on NO site is a real place, not the absence of a choice: it is where the things that
   * belong to the installation rather than to any one site are managed. Only a platform admin has
   * it — a site's own administrator has no platform scope to step into.
   */
  private renderPlatformRow(): ReactElement | null {
    if (!this.canManagePlatform) return null;
    const isCurrent = this.current === null;
    return (
      <button
        type="button"
        role="option"
        aria-selected={isCurrent}
        className={isCurrent ? 'fc-site__item fc-site__item--current' : 'fc-site__item'}
        onClick={this.onLeave}
      >
        <span className="fc-site__item-mark" aria-hidden="true">
          {isCurrent ? <FrameworkIcons.Check size={13} /> : null}
        </span>
        <span className="fc-site__item-text">
          <span className="fc-site__item-label">Platform</span>
          <span className="fc-site__item-host">No site — plugins, themes, sources, sites, platform settings</span>
        </span>
      </button>
    );
  }

  /**
   * Marks a site this account reaches only through the platform-admin role.
   *
   * The words used to be "platform", which read as "this IS the platform site" — the opposite of
   * what it means — and made whichever site came first look like the installation itself.
   */
  private static roleBadge(): ReactElement {
    return (
      <span className="fc-site__platform" title="You reach this site through your platform-admin role — you are not a member of it">
        via platform role
      </span>
    );
  }

  private renderTenant(tenant: TenantOption): ReactElement {
    const isCurrent = tenant.id === this.current;
    return (
      <button
        key={tenant.id}
        type="button"
        role="option"
        aria-selected={isCurrent}
        className={isCurrent ? 'fc-site__item fc-site__item--current' : 'fc-site__item'}
        onClick={() => (tenant.isWorkspace ? this.onAskMode(tenant) : this.onSelect(tenant))}
      >
        <span className="fc-site__item-mark" aria-hidden="true">
          {isCurrent ? <FrameworkIcons.Check size={13} /> : null}
        </span>
        <span className="fc-site__item-text">
          <span className="fc-site__item-label">
            {tenant.label}
            {tenant.isWorkspace ? <span className="fc-site__platform" title="Workspace — its domain is the console">workspace</span> : null}
            {tenant.platformAccess ? TenantSwitcherMenu.roleBadge() : null}
          </span>
          <span className="fc-site__item-host">{tenant.primaryHost}</span>
        </span>
      </button>
    );
  }

  render(): ReactElement {
    return (
      <div className="fc-site__menu" role="listbox" aria-label="Switch site">
        <div className="fc-site__menu-head">Switch site</div>
        {this.renderPlatformRow()}
        {this.tenants.map((tenant) => this.renderTenant(tenant))}
        {this.canManagePlatform ? (
          <a className="fc-site__manage" href={AdminPathUtils.toAdminPath(AdminConstants.ROUTES.SITES.ROOT)}>
            <FrameworkIcons.Settings size={12} />
            <span>Manage sites</span>
          </a>
        ) : null}
      </div>
    );
  }
}
