import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { FormEvent, ReactElement } from 'react';
import { Card } from '@/components/ui/view/card.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';

import { Input } from '@/components/ui/view/input.client';

import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminComponent } from '@/components/view/admin-component.client';
import { NewRolePermissionsCard } from '@/app/users/roles/new/components/view/new-role-permissions-card.client';
import { NewRoleSummarySidebar } from '@/app/users/roles/new/components/view/new-role-summary-sidebar.client';
import type { INewRoleFormData } from '@/app/users/roles/new/interfaces/new-role-form-data.interface';
import { state } from '@fromcode119/reactor';

export class NewRolePage extends AdminComponent {
  private mounted = false;

  @state loading = false;

  @state permissions: any[] = [];

  @state formData: INewRoleFormData = {
    slug: '',
    name: '',
    description: '',
    type: 'custom',
    permissions: [],
  };

  componentDidMount(): void {
    this.mounted = true;
    void this.loadPermissions();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async loadPermissions(): Promise<void> {
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERMISSIONS);
      if (this.mounted) this.permissions = data || [];
    } catch (e) {
      console.error("Failed to load permissions", e);
    }
  }

  private patchForm(patch: Partial<INewRoleFormData>): void {
    this.formData = { ...this.formData, ...patch };
  }

  private togglePermission(perm: string): void {
    this.formData = {
      ...this.formData,
      permissions: this.formData.permissions.includes(perm)
        ? this.formData.permissions.filter(p => p !== perm)
        : [...this.formData.permissions, perm],
    };
  }

  private handleNameChange(val: string): void {
    const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '-');
    this.formData = {
      ...this.formData,
      name: val,
      slug: this.formData.slug === '' || this.formData.slug === val.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, -1) ? slug : this.formData.slug,
    };
  }

  private async handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    this.loading = true;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.ROLES, this.formData);
      this.runtime.notify.notify(NotificationType.SUCCESS, 'Role created', `"${this.formData.name}" was created.`);
      this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST);
    } catch (e: any) {
      this.runtime.notify.notify(NotificationType.ERROR, 'Could not create role', e?.message || 'Failed to save role.');
    } finally {
      this.loading = false;
    }
  }

  render(): ReactElement {
    const theme = this.theme;
    const { loading, permissions, formData } = this;
    return (
      <div className="w-full flex flex-col animate-in fade-in duration-300">
        <CompactPageHeader
          theme={theme}
          onBack={() => this.router.back()}
          title="Create new role"
          subtitle="Define a set of permissions to assign to users."
        />

        <div className="flex-1 w-full px-6 lg:px-8 py-6">
          <form onSubmit={(e) => this.handleSubmit(e)} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <Card title="Role Details">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Name"
                      placeholder="e.g. Editor"
                      value={formData.name}
                      onChange={(e) => this.handleNameChange(e.target.value)}
                      required
                      size={FieldSize.SM}
                    />
                    <Input
                      label="Slug (System ID)"
                      placeholder="e.g. editor"
                      value={formData.slug}
                      onChange={(e) => this.patchForm({ slug: e.target.value })}
                      required
                      size={FieldSize.SM}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-tight text-slate-400 pl-1">Description</label>
                    <textarea
                      className={`w-full h-24 rounded-lg p-3 border outline-none transition-colors text-sm font-medium ${
                        theme === ThemeMode.DARK ? 'bg-slate-950/50 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
                      }`}
                      placeholder="Optional description of what this role allows..."
                      value={formData.description}
                      onChange={(e) => this.patchForm({ description: e.target.value })}
                    />
                  </div>
                </div>
              </Card>

              <NewRolePermissionsCard
                theme={theme}
                permissions={permissions}
                selected={formData.permissions}
                onToggle={(perm) => this.togglePermission(perm)}
              />
            </div>

            <NewRoleSummarySidebar
              permissionCount={formData.permissions.length}
              loading={loading}
              onCancel={() => this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST)}
            />
          </form>
        </div>
      </div>
    );
  }
}
