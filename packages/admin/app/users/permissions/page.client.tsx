import type { ReactElement } from 'react';
import Link from 'next/link';
import { state } from '@fromcode119/react-class-components';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminPageFooter } from '@/components/ui/view/admin-page-footer.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { PermissionCatalogGroupCard } from '@/app/users/permissions/components/view/permission-catalog-group-card.client';
import type { IPermissionCatalogGroup } from '@/app/users/roles/interfaces/permission-catalog-group.interface';

/**
 * Every permission a role can hold on this site, and which roles hold each one.
 *
 * Read-only: a permission is not a thing to define. Each is a name some gate checks — the
 * framework's own, or derived from a plugin this site runs (its screens, and each operation on each
 * of its collections). Roles are where they are given out.
 */
export class PermissionsPage extends AdminComponent {
  private mounted = false;

  @state catalog: IPermissionCatalogGroup[] = [];
  @state roles: Array<{ slug: string; name: string; permissions: string[] }> = [];
  @state loading = true;
  /** Set when the list could not be loaded, so an empty page is never passed off as "no permissions". */
  @state loadError = '';

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(): Promise<void> {
    try {
      const [catalog, roles] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERMISSIONS),
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.ROLES),
      ]);
      if (!this.mounted) return;
      this.catalog = Array.isArray(catalog) ? catalog : [];
      this.roles = (Array.isArray(roles) ? roles : []).map((role: any) => ({
        slug: String(role.slug),
        name: String(role.name || role.slug),
        permissions: Array.isArray(role.permissions) ? role.permissions : [],
      }));
    } catch (error: any) {
      if (this.mounted) this.loadError = error?.message || 'The permission list could not be loaded.';
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  render(): ReactElement {
    const theme = this.theme;
    if (this.loading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label="Loading permissions..." />
        </div>
      );
    }

    const everything = this.roles.filter((role) => role.permissions.includes('*'));
    const scoped = this.roles.filter((role) => !role.permissions.includes('*'));

    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-300">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Lock size={18} strokeWidth={2} />}
          title="Permissions"
          subtitle="What a role can be given on this site, and which roles give it."
        />

        <div className="flex-1 w-full px-6 lg:px-8 py-6">
          <div className="space-y-6 pb-8">
            {this.loadError ? (
              <div className="fc-scope-notice"><span className="fc-scope-notice__text">{this.loadError}</span></div>
            ) : (
              <div className="fc-scope-notice">
                <span className="fc-scope-notice__text">
                  Each permission is checked by the screen or action it names; plugin permissions follow the plugins this site runs.
                  {everything.length > 0 ? <> {everything.map((role) => role.name).join(', ')} {everything.length === 1 ? 'holds' : 'hold'} everything and {everything.length === 1 ? 'is' : 'are'} not repeated below.</> : null}
                  {' '}To give permissions out, <Link href={AdminConstants.ROUTES.USERS.ROLE_LIST}>edit a role</Link>.
                </span>
              </div>
            )}
            {this.catalog.map((group) => (
              <PermissionCatalogGroupCard key={group.key} group={group} roles={scoped} />
            ))}
          </div>
        </div>

        <AdminPageFooter
          label="Permissions"
          description="Checked by the framework and by each plugin this site runs."
          links={[
            { label: 'Users', href: AdminConstants.ROUTES.USERS.LIST },
            { label: 'Roles', href: AdminConstants.ROUTES.USERS.ROLE_LIST },
            { label: 'Activity Log', href: AdminConstants.ROUTES.ACTIVITY },
          ]}
        />
      </div>
    );
  }
}
