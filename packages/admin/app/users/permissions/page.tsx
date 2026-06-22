"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import { FrameworkIcons } from '@fromcode119/react';
import { DataTable } from '@/components/ui/data-table';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { Loader } from '@/components/ui/loader';
import { AdminPageFooter } from '@/components/ui/admin-page-footer';
import { AdminComponent } from '@/components/admin-component';
import { PermissionsColumns } from './permissions-columns';
import type { PermissionsPageState } from './permissions-page.interfaces';

export default class PermissionsPage extends AdminComponent<Record<string, never>, PermissionsPageState> {
  private mounted = false;

  state: PermissionsPageState = { permissions: [], loading: true };

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
      if (this.mounted) this.setState({ permissions: Array.isArray(data) ? data : [] });
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    } finally {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  render(): React.ReactElement {
    const theme = this.theme;
    const { permissions, loading } = this.state;

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
              theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200/60'
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
