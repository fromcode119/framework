import { FrameworkIcons } from '@fromcode119/react';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import type { TenantOption } from '@/lib/tenants/tenant-option';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The "Sites" group of the account menu: which site you are editing, and every other place you may go.
 *
 * It took over from the header's site switcher when the header went, so it carries everything that
 * switcher offered: the Platform row a platform admin steps out to, the two ways a platform admin
 * opens a WORKSPACE (as its own console, or configured in the default one), the "via platform role"
 * mark on a site the account does not belong to, and — on a single-site deployment with no site
 * records — the host being served, so "which site am I editing" is still answered.
 */
export class SidebarSiteItems {
  private static readonly APPEARANCE = 'appearance';
  private static readonly CONFIGURE = 'configure';

  static build(input: {
    tenants: TenantOption[];
    current: string | null;
    /** How the current workspace was opened: `appearance` or `configure` (the server's `mode`). */
    mode: string;
    multiTenant: boolean;
    storefrontHost: string;
    canManagePlatform: boolean;
    onSelect: (tenantId: string, mode?: string) => void;
    onLeave: () => void;
    onAddSite: () => void;
  }): IDropdownItem[] {
    const rows: IDropdownItem[] = [];
    if (input.multiTenant && input.canManagePlatform) {
      rows.push({
        label: AdminI18n.t('shell.site.platform'),
        detail: AdminI18n.t('shell.site.platformHint'),
        selectable: true,
        selected: input.current === null,
        onClick: input.onLeave,
      });
    }
    for (const tenant of input.tenants) rows.push(...SidebarSiteItems.tenantRows(tenant, input.current, input.mode, input.onSelect));
    if (!input.multiTenant && input.storefrontHost) {
      rows.push({
        label: input.storefrontHost,
        detail: AdminI18n.t('shell.account.singleSite'),
        selectable: true,
        selected: true,
        onClick: () => { /* Already here — the row states which site you are editing. */ },
      });
    }

    const heading = AdminI18n.t('shell.account.sites');
    return [
      // `scrolls` bounds the site list in its own box: it grows with the installation, and the rows
      // after it (Add a site, Sign out) must stay reachable however many sites exist.
      ...rows.map((row, index) => ({ ...row, section: index === 0 ? heading : undefined, scrolls: index === 0 ? true : undefined })),
      // Adding a site is the platform's to do: the Sites screen and its API are platform-admin only.
      ...(input.canManagePlatform ? [{
        label: AdminI18n.t('shell.account.addSite'),
        icon: <FrameworkIcons.Plus size={16} />,
        section: rows.length === 0 ? heading : undefined,
        onClick: input.onAddSite,
      }] : []),
    ];
  }

  /** A site is one row; a workspace is two — open it as its own console, or configure it. */
  private static tenantRows(tenant: TenantOption, current: string | null, mode: string, onSelect: (tenantId: string, mode?: string) => void): IDropdownItem[] {
    const viaRole = tenant.platformAccess ? ` · ${AdminI18n.t('shell.site.viaRole')}` : '';
    const selected = tenant.id === current;
    if (!tenant.isWorkspace) {
      return [{ label: tenant.label, detail: `${tenant.primaryHost}${viaRole}`, selectable: true, selected, onClick: () => onSelect(tenant.id) }];
    }
    return [
      {
        label: `${tenant.label} · ${tenant.appearanceLabel}`,
        detail: `${AdminI18n.t('shell.site.appearanceHint')}${viaRole}`,
        selectable: true,
        selected: selected && mode !== SidebarSiteItems.CONFIGURE,
        onClick: () => onSelect(tenant.id, SidebarSiteItems.APPEARANCE),
      },
      {
        label: `${tenant.label} · ${AdminI18n.t('shell.site.configure')}`,
        detail: AdminI18n.t('shell.site.configureHint'),
        selectable: true,
        selected: selected && mode === SidebarSiteItems.CONFIGURE,
        onClick: () => onSelect(tenant.id, SidebarSiteItems.CONFIGURE),
      },
    ];
  }

  /**
   * The server's refusal of a switch, in words an operator can act on. Each reason is a different
   * next step — ask for access, use the shared console, read the log — so they are never collapsed
   * into "could not switch", and an unrecognised code is shown rather than hidden.
   */
  static reasonFor(error: unknown): string {
    const code = String((error as { code?: unknown; error?: unknown } | null)?.code
      ?? (error as { error?: unknown } | null)?.error ?? '').trim();
    if (code === 'tenant_access_denied') return AdminI18n.t('shell.site.notAdmin');
    if (code === 'workspace_host_locks_tenant') return AdminI18n.t('shell.site.locked');
    if (code === 'not_multi_tenant') return AdminI18n.t('shell.site.single');
    if (code === 'tenantId_required') return AdminI18n.t('shell.site.noneNamed');
    const message = String((error as { message?: unknown } | null)?.message ?? '').trim();
    if (code) return AdminI18n.t('shell.site.switchFailed', { reason: code });
    return message ? AdminI18n.t('shell.site.switchFailed', { reason: message }) : AdminI18n.t('shell.site.switchFailedNoReason');
  }
}
