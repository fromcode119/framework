import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { FormEvent, ReactElement } from 'react';
import { Card } from '@/components/ui/view/card.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';

import { Input } from '@/components/ui/view/input.client';

import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { Loader } from '@/components/ui/view/loader.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { EditRolePermissionsCard } from '@/app/users/roles/[slug]/edit/components/view/edit-role-permissions-card.client';
import { EditRoleSummarySidebar } from '@/app/users/roles/[slug]/edit/components/view/edit-role-summary-sidebar.client';
import type { IEditRoleFormData } from '@/app/users/roles/[slug]/edit/interfaces/edit-role-form-data.interface';
import { prop, state } from '@fromcode119/reactor';

export class EditRolePage extends AdminComponent {
  @prop declare params: Promise<{ slug: string }>;

  @state roleSlug = '';
  @state loading = false;
  @state fetching = true;
  @state permissions: any[] = [];
  @state formData: IEditRoleFormData = {
    slug: '',
    name: '',
    description: '',
    type: 'custom',
    permissions: []
  };

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.params;
    if (!this.mounted) return;
    this.roleSlug = params.slug;
    void this.loadData();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async loadData(): Promise<void> {
    const notify = this.runtime.notify.notify;
    try {
      this.fetching = true;
      const [permsData, roleData] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERMISSIONS),
        AdminApi.get(`${AdminConstants.ENDPOINTS.SYSTEM.ROLES}/${this.roleSlug}`)
      ]);

      if (!this.mounted) return;
      this.permissions = permsData || [];
      if (roleData) {
        this.formData = {
          slug: roleData.slug || '',
          name: roleData.name || '',
          description: roleData.description || '',
          type: roleData.type || 'custom',
          permissions: roleData.permissions || []
        };
      }
    } catch (e) {
      console.error("Failed to load role data", e);
      notify(NotificationType.ERROR, 'Load Failed', 'Could not retrieve role details.');
      this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST);
    } finally {
      if (this.mounted) this.fetching = false;
    }
  }

  private togglePermission(perm: string): void {
    this.formData = {
      ...this.formData,
      permissions: this.formData.permissions.includes(perm)
        ? this.formData.permissions.filter((p) => p !== perm)
        : [...this.formData.permissions, perm]
    };
  }

  private updateForm(patch: Partial<IEditRoleFormData>): void {
    this.formData = { ...this.formData, ...patch };
  }

  private async handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const notify = this.runtime.notify.notify;
    this.loading = true;
    try {
      await AdminApi.put(`${AdminConstants.ENDPOINTS.SYSTEM.ROLES}/${this.roleSlug}`, this.formData);
      notify(NotificationType.SUCCESS, 'Role Updated', `${this.formData.name} has been synchronized.`);
      this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST);
    } catch (e: any) {
      console.error("Failed to update role", e);
      notify(NotificationType.ERROR, 'Update Failed', e.message || "An error occurred while saving.");
    } finally {
      this.loading = false;
    }
  }

  render(): ReactElement {
    const theme = this.theme;
    const { fetching, loading, permissions, formData } = this;

    if (fetching) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label="Synchronizing Role Manifest..." />
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col animate-in fade-in duration-300">
        <CompactPageHeader
          theme={theme}
          onBack={() => this.router.back()}
          title={`Edit role: ${formData.name}`}
          subtitle="Modify permission sets and metadata."
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
                      onChange={(e) => this.updateForm({ name: e.target.value })}
                      required
                      size={FieldSize.SM}
                    />
                    <Input
                      label="Slug (System ID)"
                      placeholder="e.g. editor"
                      value={formData.slug}
                      disabled
                      size={FieldSize.SM}
                      className="opacity-50 grayscale"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-tight text-slate-400 pl-1">Description</label>
                    <textarea
                      className={`w-full h-24 rounded-lg p-3 border outline-none transition-colors text-sm font-medium ${
                        theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
                      }`}
                      placeholder="Optional description of what this role allows..."
                      value={formData.description}
                      onChange={(e) => this.updateForm({ description: e.target.value })}
                    />
                  </div>
                </div>
              </Card>

              <EditRolePermissionsCard
                theme={theme}
                permissions={permissions}
                selected={formData.permissions}
                onToggle={(perm) => this.togglePermission(perm)}
              />
            </div>

            <EditRoleSummarySidebar
              type={formData.type}
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
