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
import { RolePermissionsEditor } from '@/app/users/roles/components/view/role-permissions-editor.client';
import type { IPermissionCatalogGroup } from '@/app/users/roles/interfaces/permission-catalog-group.interface';
import { EditRoleSummarySidebar } from '@/app/users/roles/[slug]/edit/components/view/edit-role-summary-sidebar.client';
import type { IEditRoleFormData } from '@/app/users/roles/[slug]/edit/interfaces/edit-role-form-data.interface';
import { prop, state } from '@fromcode119/react-class-components';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class EditRolePage extends AdminComponent {
  @prop declare params: Promise<{ slug: string }>;

  @state roleSlug = '';
  @state loading = false;
  @state fetching = true;
  @state catalog: IPermissionCatalogGroup[] = [];
  /** False for a role this editor may not change here — a platform role inside a site (API's `editable`). */
  @state editable = true;
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
      const [catalog, roleData] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.PERMISSIONS),
        AdminApi.get(`${AdminConstants.ENDPOINTS.SYSTEM.ROLES}/${this.roleSlug}`)
      ]);

      if (!this.mounted) return;
      this.catalog = Array.isArray(catalog) ? catalog : [];
      if (roleData) {
        this.editable = roleData.editable !== false;
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
      notify(NotificationType.ERROR, AdminI18n.t('users.loadFailed'), AdminI18n.t('users.couldNotRetrieveRoleDetails'));
      this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST);
    } finally {
      if (this.mounted) this.fetching = false;
    }
  }

  private updateForm(patch: Partial<IEditRoleFormData>): void {
    this.formData = { ...this.formData, ...patch };
  }

  private async handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!this.editable) return;
    const notify = this.runtime.notify.notify;
    this.loading = true;
    try {
      await AdminApi.put(`${AdminConstants.ENDPOINTS.SYSTEM.ROLES}/${this.roleSlug}`, this.formData);
      notify(NotificationType.SUCCESS, AdminI18n.t('users.roleUpdated'), AdminI18n.t('users.wasSaved', { name: this.formData.name }));
      this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST);
    } catch (e: any) {
      console.error("Failed to update role", e);
      notify(NotificationType.ERROR, AdminI18n.t('users.updateFailed'), e.message || AdminI18n.t('users.anErrorOccurredWhileSaving'));
    } finally {
      this.loading = false;
    }
  }

  render(): ReactElement {
    const theme = this.theme;
    const { fetching, loading, catalog, formData, editable } = this;

    if (fetching) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label={AdminI18n.t('users.loadingRole')} />
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col animate-in fade-in duration-300">
        <CompactPageHeader
          theme={theme}
          onBack={() => this.router.back()}
          title={AdminI18n.t('users.editRole', { name: formData.name })}
          subtitle={AdminI18n.t('users.modifyPermissionSetsAndMetadata')}
        />

        <div className="flex-1 w-full px-6 lg:px-8 py-6">
          <form onSubmit={(e) => this.handleSubmit(e)} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              {editable ? null : (
                <p className="text-xs font-bold text-slate-500 bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
                  {AdminI18n.t('users.platformRoleLockedHint')}
                </p>
              )}
              <Card title={AdminI18n.t('users.roleDetails')}>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label={AdminI18n.t('users.name')}
                      placeholder={AdminI18n.t('users.eGEditor')}
                      value={formData.name}
                      onChange={(e) => this.updateForm({ name: e.target.value })}
                      disabled={!editable}
                      required
                      size={FieldSize.SM}
                    />
                    <Input
                      label={AdminI18n.t('users.slugSystemId')}
                      placeholder={AdminI18n.t('users.roleSlugExample')}
                      value={formData.slug}
                      disabled
                      size={FieldSize.SM}
                      className="opacity-50 grayscale"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-tight text-slate-400 pl-1">{AdminI18n.t('users.description')}</label>
                    <textarea
                      className={`w-full h-24 rounded-lg p-3 border outline-none transition-colors text-sm font-medium ${
                        theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
                      }`}
                      placeholder={AdminI18n.t('users.optionalDescriptionOfWhatThis')}
                      value={formData.description}
                      disabled={!editable}
                      onChange={(e) => this.updateForm({ description: e.target.value })}
                    />
                  </div>
                </div>
              </Card>

              <RolePermissionsEditor
                groups={catalog}
                selected={formData.permissions}
                onChange={(permissions) => this.updateForm({ permissions })}
                readOnly={!editable}
              />
            </div>

            <EditRoleSummarySidebar
              type={formData.type}
              permissionCount={formData.permissions.length}
              loading={loading}
              readOnly={!editable}
              onCancel={() => this.router.push(AdminConstants.ROUTES.USERS.ROLE_LIST)}
            />
          </form>
        </div>
      </div>
    );
  }
}
