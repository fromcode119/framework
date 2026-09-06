import type { ReactElement } from 'react';
import { bound, state } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminComponent } from '@/components/view/admin-component.client';
import { TenantOption } from '@/lib/tenants/tenant-option';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminPathUtils } from '@/lib/admin-path';

/**
 * Which customer's site am I editing, and how do I move to another one?
 *
 * Renders NOTHING on a single-tenant deployment. With exactly one reachable site it renders that site's
 * name as a plain label — knowing WHOSE site you are editing still matters, but a switcher that cannot
 * switch is a control implying a capability that does not exist.
 *
 * Switching re-mints the session on the server and then RELOADS: it is a change of identity context,
 * not a client-side filter, so in-memory data belonging to the previous tenant must not survive it.
 *
 * The menu closes on Escape and on any click outside it, and the trigger reports `aria-expanded`, so
 * it behaves like every other popover in the admin rather than a bare list that stays open until the
 * next selection.
 */
export class TenantSwitcher extends AdminComponent {
  @state tenants: TenantOption[] = [];
  @state current: string | null = null;
  @state multiTenant = false;
  @state busy = false;
  @state open = false;
  /** A workspace picked from the menu: the platform admin then chooses HOW to open it (T6 §3.3). */
  @state pending: TenantOption | null = null;

  private mounted = false;
  private readonly root = this.ref<HTMLDivElement>();

  componentDidMount(): void {
    this.mounted = true;
    this.load();
    this.listen(document, 'mousedown', this.onDocumentMouseDown);
    this.listen(document, 'keydown', this.onDocumentKeyDown);
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(): Promise<void> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.TENANTS_AVAILABLE).catch(() => null);
    if (!this.mounted || !response) return;
    this.multiTenant = response.multiTenant === true;
    this.current = response.current ?? null;
    this.tenants = TenantOption.fromList(response.tenants);
  }

  private async select(tenantId: string, mode?: string): Promise<void> {
    if (this.busy) return;
    if (tenantId === this.current && !mode) {
      this.open = false;
      return;
    }
    this.busy = true;
    const ok = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.TENANTS_SELECT, mode ? { tenantId, mode } : { tenantId })
      .then(() => true)
      .catch(() => false);
    if (!ok) {
      this.busy = false;
      return;
    }
    // Full reload, deliberately: the previous tenant's data must not linger in memory.
    window.location.reload();
  }

  @bound
  private onDocumentMouseDown(event: Event): void {
    if (!this.open) return;
    const root = this.root.current;
    if (root && event.target instanceof Node && !root.contains(event.target)) this.open = false;
  }

  @bound
  private onDocumentKeyDown(event: Event): void {
    if (this.open && (event as KeyboardEvent).key === 'Escape') this.open = false;
  }

  @bound
  private toggle(): void {
    this.open = !this.open;
    if (!this.open) this.pending = null;
  }

  private askMode(tenant: TenantOption): void {
    this.pending = tenant;
  }

  /** The two ways a platform admin opens a workspace: as its own console, or the default console to configure it. */
  private renderModeChoice(tenant: TenantOption): ReactElement {
    return (
      <div className="fc-site__menu" role="listbox" aria-label={`Open ${tenant.label}`}>
        <div className="fc-site__menu-head">Open {tenant.label} as</div>
        <button type="button" role="option" className="fc-site__item" onClick={() => this.select(tenant.id, 'appearance')}>
          <span className="fc-site__item-mark" aria-hidden="true" />
          <span className="fc-site__item-text">
            <span className="fc-site__item-label">{tenant.appearanceLabel}</span>
            <span className="fc-site__item-host">What this workspace's own admins see</span>
          </span>
        </button>
        <button type="button" role="option" className="fc-site__item" onClick={() => this.select(tenant.id, 'configure')}>
          <span className="fc-site__item-mark" aria-hidden="true" />
          <span className="fc-site__item-text">
            <span className="fc-site__item-label">Configure</span>
            <span className="fc-site__item-host">The default console with every setting</span>
          </span>
        </button>
        <button type="button" className="fc-site__item" onClick={() => { this.pending = null; }}>
          <span className="fc-site__item-mark" aria-hidden="true" />
          <span className="fc-site__item-text"><span className="fc-site__item-host">Back</span></span>
        </button>
      </div>
    );
  }

  private get canSwitch(): boolean {
    return this.multiTenant && this.tenants.length > 1;
  }

  private get currentOption(): TenantOption | undefined {
    return this.tenants.find((tenant) => tenant.id === this.current);
  }

  /** Is the tenant currently selected one this account only reaches as a platform admin? */
  private get currentIsPlatformAccess(): boolean {
    return this.currentOption ? this.currentOption.platformAccess : false;
  }

  render(): ReactElement | null {
    // Single tenant, or tenancy off entirely: no control at all.
    if (!this.multiTenant || this.tenants.length === 0) return null;

    if (!this.canSwitch) {
      const only = this.tenants[0];
      return (
        <span className="fc-site fc-site--static" title={`Editing ${only.primaryHost}`}>
          <FrameworkIcons.Globe size={13} className="fc-site__icon" />
          <span className="fc-site__name">{only.label}</span>
          {only.platformAccess ? TenantSwitcher.platformBadge() : null}
        </span>
      );
    }

    const selected = this.currentOption;
    return (
      <div className="fc-site" ref={this.root}>
        <button
          type="button"
          className={selected ? 'fc-site__trigger' : 'fc-site__trigger fc-site__trigger--unset'}
          disabled={this.busy}
          aria-haspopup="listbox"
          aria-expanded={this.open}
          title={selected ? `Editing ${selected.primaryHost} — click to switch site` : 'No site selected — choose one to start editing'}
          onClick={this.toggle}
        >
          <FrameworkIcons.Globe size={13} className="fc-site__icon" />
          <span className="fc-site__text">
            <span className="fc-site__eyebrow">{selected ? 'Site' : 'No site selected'}</span>
            <span className="fc-site__name">{selected ? selected.label : 'Choose a site'}</span>
          </span>
          {this.currentIsPlatformAccess ? TenantSwitcher.platformBadge() : null}
          <FrameworkIcons.ChevronDown size={13} className={this.open ? 'fc-site__caret fc-site__caret--open' : 'fc-site__caret'} />
        </button>

        {this.open && this.pending ? this.renderModeChoice(this.pending) : null}
        {this.open && !this.pending ? (
          <div className="fc-site__menu" role="listbox" aria-label="Switch site">
            <div className="fc-site__menu-head">Switch site</div>
            {this.tenants.map((tenant) => {
              const isCurrent = tenant.id === this.current;
              return (
                <button
                  key={tenant.id}
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  className={isCurrent ? 'fc-site__item fc-site__item--current' : 'fc-site__item'}
                  onClick={() => (tenant.isWorkspace ? this.askMode(tenant) : this.select(tenant.id))}
                >
                  <span className="fc-site__item-mark" aria-hidden="true">
                    {isCurrent ? <FrameworkIcons.Check size={13} /> : null}
                  </span>
                  <span className="fc-site__item-text">
                    <span className="fc-site__item-label">
                      {tenant.label}
                      {tenant.isWorkspace ? <span className="fc-site__platform" title="Workspace — its domain is the console">workspace</span> : null}
                      {tenant.platformAccess ? TenantSwitcher.platformBadge() : null}
                    </span>
                    <span className="fc-site__item-host">{tenant.primaryHost}</span>
                  </span>
                </button>
              );
            })}
            {this.canManageSites ? (
              <a className="fc-site__manage" href={AdminPathUtils.toAdminPath(AdminConstants.ROUTES.SITES.ROOT)}>
                <FrameworkIcons.Settings size={12} />
                <span>Manage sites</span>
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  /** Creating, importing and deleting sites is the platform's job; the menu links there only for a platform admin. */
  private get canManageSites(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user);
  }

  /**
   * Marks a tenant this account reaches only through the platform-admin role.
   *
   * The title is the whole point of the control: it names WHY access exists, so an operator cannot
   * mistake someone else's customer for one of its own.
   */
  private static platformBadge(): ReactElement {
    return (
      <span className="fc-site__platform" title="Platform access — you are not a member of this site">
        platform
      </span>
    );
  }
}
