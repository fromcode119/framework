import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactElement } from 'react';
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
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { TextArea } from '@/components/ui/view/text-area.client';
import { Alert } from '@/components/ui/view/alert.client';
import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import { PendingSavesBar } from '@/components/ui/view/pending-saves-bar.client';

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
  private pending: PendingSave | null = null;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    this.pending = new PendingSave(() => this.formData, () => this.save(), (values: IEditRoleFormData) => { this.formData = values; });
    const params = await this.params;
    if (!this.mounted) return;
    this.roleSlug = params.slug;
    void this.loadData();
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.mounted = false;
    this.pending?.dispose();
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
        this.pending?.mark();
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

  /** Written by the page's save bar; the page stays on the role it saved. */
  private async save(): Promise<void> {
    if (!this.editable) return;
    this.loading = true;
    try {
      await AdminApi.put(`${AdminConstants.ENDPOINTS.SYSTEM.ROLES}/${this.roleSlug}`, this.formData);
    } catch (e: any) {
      console.error("Failed to update role", e);
      this.pending?.failed();
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('users.updateFailed'), e.message || AdminI18n.t('users.anErrorOccurredWhileSaving'));
    } finally {
      this.loading = false;
    }
  }

  render(): ReactElement {
    const theme = this.theme;
    const { fetching, catalog, formData, editable } = this;

    if (fetching) {
      return (
        <div className="flex-1 flex items-center justify-center py-20">
          <Loader label={AdminI18n.t('users.loadingRole')} />
        </div>
      );
    }

    return (
      <div className={`w-full flex flex-col animate-in fade-in duration-300 ${AdminClass.of('settings-page')}`}>
        <CompactPageHeader
          theme={theme}
          onBack={() => this.router.back()}
          title={AdminI18n.t('users.editRole', { name: formData.name })}
          subtitle={AdminI18n.t('users.modifyPermissionSetsAndMetadata')}
        />

        <div className="w-full py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              {editable ? null : <Alert tone="warning">{AdminI18n.t('users.platformRoleLockedHint')}</Alert>}
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
                    />
                  </div>
                  <TextArea label={AdminI18n.t('users.description')}
                      placeholder={AdminI18n.t('users.optionalDescriptionOfWhatThis')}
                      value={formData.description}
                      disabled={!editable}
                      onChange={(e) => this.updateForm({ description: e.target.value })}
                    />
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
              readOnly={!editable}
            />
          </div>
        </div>
        <PendingSavesBar />
      </div>
    );
  }
}
