import type { ReactElement } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminSiteBinding } from '@/lib/admin-site-binding';
import { AdminComponent } from '@/components/view/admin-component.client';
import { TenantOption } from '@/lib/tenants/tenant-option';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { TenantScopeClient } from '@/lib/tenants/tenant-scope-client';
import { TenantSwitcherMenu } from '@/app/components/view/tenant-switcher-menu.client';

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
  /**
   * Why the last switch did not happen, shown in the menu.
   *
   * A failed switch used to be SILENT: the request's error was discarded by `.catch(() => false)`,
   * the menu closed, the scope did not change, and the operator was told nothing at all — not in the
   * UI, not in the console. Every reason the server gives is one an operator can act on
   * (`tenant_access_denied`, `workspace_host_locks_tenant`, `not_multi_tenant`), and throwing them
   * away left "I clicked the site and nothing happened" as the whole diagnosis, for them and for
   * anyone they asked.
   */
  @state failure: string | null = null;
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
    // `noDedupe`, like every call in SitesClient: `AdminApi.get` memoises GET responses, and WHICH
    // SITE YOU ARE ON is the one answer that must never come from a cache — it changes underneath
    // this component every time somebody switches or steps out, and a stale hit leaves the header
    // naming a site the session has already left.
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.TENANTS_AVAILABLE, { noDedupe: true }).catch(() => null);
    if (!this.mounted || !response) return;
    this.multiTenant = response.multiTenant === true;
    this.current = response.current ?? null;
    AdminSiteBinding.record(this.current);
    this.tenants = TenantOption.fromList(response.tenants);
  }

  /**
   * Step out of every site, into the platform scope.
   *
   * The way back out. Picking a site used to be one-way — nothing could un-set the claim — so the
   * only route to the console's own surfaces was to log in again.
   */
  @bound private async leave(): Promise<void> {
    if (this.busy || this.current === null) {
      this.open = false;
      return;
    }
    this.busy = true;
    const ok = await TenantScopeClient.leave();
    if (!ok) {
      this.busy = false;
      return;
    }
    // Full reload, for the same reason selecting one does: the site's data must not linger.
    window.location.reload();
  }

  /**
   * The server's refusal, in words an operator can act on.
   *
   * Every one of these is a DIFFERENT thing to do next, which is the whole argument for not
   * collapsing them into "could not switch": being a customer of a site is fixed by asking for
   * access, a workspace host is fixed by using the shared console, and an unknown code is fixed by
   * reading the log — so the code is shown rather than hidden when it is not one we recognise.
   */
  private static reasonFor(error: unknown): string {
    const code = String((error as { code?: unknown; error?: unknown } | null)?.code
      ?? (error as { error?: unknown } | null)?.error ?? '').trim();
    if (code === 'tenant_access_denied') return 'You are not an administrator of that site.';
    if (code === 'workspace_host_locks_tenant') return 'This console is fixed to one site. Use the shared console to switch.';
    if (code === 'not_multi_tenant') return 'This deployment serves a single site, so there is nothing to switch to.';
    if (code === 'tenantId_required') return 'No site was named in the request.';
    const message = String((error as { message?: unknown } | null)?.message ?? '').trim();
    if (code) return `Could not switch: ${code}`;
    return message ? `Could not switch: ${message}` : 'Could not switch, and the server gave no reason.';
  }

  private async select(tenantId: string, mode?: string): Promise<void> {
    if (this.busy) return;
    if (tenantId === this.current && !mode) {
      this.open = false;
      return;
    }
    this.busy = true;
    this.failure = null;
    // The REASON is kept. `.catch(() => false)` here discarded it, so a refused switch was
    // indistinguishable from a click that did nothing — and the server always says why.
    const failure = await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.TENANTS_SELECT, mode ? { tenantId, mode } : { tenantId })
      .then(() => null)
      .catch((error: unknown) => TenantSwitcher.reasonFor(error));
    if (failure) {
      this.failure = failure;
      this.busy = false;
      // The menu STAYS OPEN on failure. Closing it is what made this look like nothing had happened;
      // the message belongs where the operator is still looking.
      this.open = true;
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

  @bound private onAskMode(tenant: TenantOption): void {
    this.pending = tenant;
  }

  @bound private onSelectTenant(tenant: TenantOption): void {
    void this.select(tenant.id);
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

  /**
   * Is there anywhere to switch TO?
   *
   * `tenants.length > 1` alone stranded a platform admin on a deployment with exactly ONE site: login
   * auto-selects the only site an account can administer, and with the menu gone there was no way
   * back out to the platform scope. That was survivable while every platform setting stayed editable
   * from inside a site; it stops being survivable the moment a screen shows platform settings only in
   * platform scope. A platform admin always has a second destination — the platform itself.
   */
  private get canSwitch(): boolean {
    return this.multiTenant && (this.tenants.length > 1 || this.canManageSites);
  }

  private get currentOption(): TenantOption | undefined {
    return this.tenants.find((tenant) => tenant.id === this.current);
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
          title={selected
            ? `Editing ${selected.primaryHost} — click to switch site`
            : (this.canManageSites ? 'Platform scope — no site selected' : 'No site selected — choose one to start editing')}
          onClick={this.toggle}
        >
          <FrameworkIcons.Globe size={13} className="fc-site__icon" />
          <span className="fc-site__text">
            <span className="fc-site__eyebrow">{selected ? 'Site' : (this.canManageSites ? 'Platform' : 'No site selected')}</span>
            <span className="fc-site__name">{selected ? selected.label : (this.canManageSites ? 'No site' : 'Choose a site')}</span>
          </span>
          <FrameworkIcons.ChevronDown size={13} className={this.open ? 'fc-site__caret fc-site__caret--open' : 'fc-site__caret'} />
        </button>

        {this.open && this.pending ? this.renderModeChoice(this.pending) : null}
        {this.open && !this.pending ? (
          <>
            {this.failure ? (
              <p className="fc-site__failure" role="alert">{this.failure}</p>
            ) : null}
            <TenantSwitcherMenu
              tenants={this.tenants}
              current={this.current}
              canManagePlatform={this.canManageSites}
              onSelect={this.onSelectTenant}
              onAskMode={this.onAskMode}
              onLeave={this.leave}
            />
          </>
        ) : null}
      </div>
    );
  }

  /** Creating, importing and deleting sites is the platform's job; the menu links there only for a platform admin. */
  private get canManageSites(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user);
  }

}
