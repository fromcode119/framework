import { ThemeMode } from '@fromcode119/core/client';
import type { ReactElement } from 'react';
import { state } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { FrameworkIcons } from '@fromcode119/react';
import { DataTable } from '@/components/ui/view/data-table.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminPageFooter } from '@/components/ui/view/admin-page-footer.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { PermissionsColumns } from '@/app/users/permissions/components/view/permissions-columns.client';

export class PermissionsPage extends AdminComponent {
  private mounted = false;

  @state permissions: any[] = [];
  @state loading = true;

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(): Promise<void> {
    try {
      // The permissions endpoint scans active plugins' manifest.capabilities and persists new ones,
      // so simply loading the page keeps the registry in sync — no manual scan button needed.
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERMISSIONS);
      if (this.mounted) this.permissions = Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  render(): ReactElement {
    const theme = this.theme;
    const { permissions, loading } = this;

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label="Inventorying Permissions..." />
        </div>
      );
    }

    const columns = PermissionsColumns.build(theme);

    return (
      <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-300">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Zap size={18} strokeWidth={2} />}
          title="Permissions"
          subtitle="Capabilities declared by plugins and grouped into roles. Updated automatically as plugins are installed."
        />

        <div className="flex-1 w-full px-6 lg:px-8 py-6">
          <div className="space-y-6 pb-8">
            <div className={`rounded-xl border overflow-hidden shadow-sm dark:shadow-none ${
              theme === ThemeMode.DARK ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200/60'
            }`}>
              <DataTable
                columns={columns}
                data={permissions}
                totalDocs={permissions.length}
                limit={100}
                page={1}
                emptyMessage="No permissions registered in system registry"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="Security Architecture">
                <p className="text-sm text-slate-500 leading-relaxed font-medium tracking-tight">
                  Permissions are the atomic units of security in Fromcode. They are declared by plugins via their <code className="text-indigo-500">manifest.json</code> and enforced by the middleware layer. Administrators group them into roles for simplified user management.
                </p>
              </Card>
              <Card title="Synced from Plugins">
                <p className="text-sm text-slate-500 leading-relaxed font-medium tracking-tight">
                  This registry is built automatically from the capabilities active plugins declare — it refreshes whenever you open this page and as plugins are installed or updated. There is nothing to define by hand.
                </p>
              </Card>
            </div>
          </div>
        </div>

        <AdminPageFooter
          label="Permissions Registry"
          description="Manage system capabilities and plugin permissions."
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
