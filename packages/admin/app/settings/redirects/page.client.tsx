import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { RedirectsApiClient } from '@/app/settings/redirects/redirects-api-client';
import { RedirectRulesCard } from '@/app/settings/redirects/redirect-rules-card';
import { RedirectCreateCard } from '@/app/settings/redirects/redirect-create-card';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Settings → Redirects — the framework's ONE URL-redirect surface.
 *
 * Rules here catch RETIRED paths: the routing layer consults them only after a request resolves to no
 * content, so a rule can never shadow a live page. (A live document's canonical home is a different
 * mechanism — the record's own permalink field.) This surface replaced two per-plugin copies of the
 * same table (two plugins each had one); their rows were migrated into `_system_redirects`.
 */
export class RedirectsSettingsPage extends AdminComponent {
  @state isLoading = true;
  @state isCreating = false;
  /** `null` means NEVER LOADED — an empty list is a real, successfully-loaded answer. */
  @state redirects: Record<string, any>[] | null = null;
  @state loadError: string | null = null;
  @state busyId = 0;

  async componentDidMount(): Promise<void> {
    await this.loadRedirects();
  }

  @bound
  async retryLoad(): Promise<void> {
    this.isLoading = true;
    await this.loadRedirects();
  }

  private async loadRedirects(): Promise<void> {
    this.loadError = null;
    try {
      this.redirects = await RedirectsApiClient.list();
    } catch (error: any) {
      this.redirects = null;
      this.loadError = error?.message || AdminI18n.t('settings.redirects.theRedirectsRequestFailed');
    } finally {
      this.isLoading = false;
    }
  }

  private notify(message: string, type: NotificationType): void {
    this.runtime?.notify?.addNotification?.({ title: AdminI18n.t('settings.redirects.redirects'), message, type });
  }

  @bound
  async handleCreate(input: { fromPath: string; toPath: string; type: string; notes: string }): Promise<boolean> {
    this.isCreating = true;
    try {
      const created = await RedirectsApiClient.create(input);
      this.redirects = [created, ...(this.redirects || [])];
      this.notify(AdminI18n.t('settings.redirects.redirectFromCreated', { fromPath: created.fromPath }), NotificationType.SUCCESS);
      return true;
    } catch (error: any) {
      this.notify(error?.message || AdminI18n.t('settings.redirects.theRedirectCouldNotBe'), NotificationType.ERROR);
      return false;
    } finally {
      this.isCreating = false;
    }
  }

  @bound
  async handleToggle(redirect: Record<string, any>): Promise<void> {
    this.busyId = Number(redirect.id) || 0;
    try {
      const updated = await RedirectsApiClient.update(Number(redirect.id), { enabled: !redirect.enabled });
      this.redirects = (this.redirects || []).map((row) => (row.id === updated.id ? updated : row));
    } catch (error: any) {
      this.notify(error?.message || AdminI18n.t('settings.redirects.theRedirectCouldNotBe2'), NotificationType.ERROR);
    } finally {
      this.busyId = 0;
    }
  }

  @bound
  async handleDelete(redirect: Record<string, any>): Promise<void> {
    this.busyId = Number(redirect.id) || 0;
    try {
      await RedirectsApiClient.remove(Number(redirect.id));
      this.redirects = (this.redirects || []).filter((row) => row.id !== redirect.id);
      this.notify(AdminI18n.t('settings.redirects.redirectFromDeleted', { fromPath: redirect.fromPath }), NotificationType.SUCCESS);
    } catch (error: any) {
      this.notify(error?.message || AdminI18n.t('settings.redirects.theRedirectCouldNotBe3'), NotificationType.ERROR);
    } finally {
      this.busyId = 0;
    }
  }

  render(): ReactNode {
    const theme = this.theme;
    if (this.isLoading) {
      return <Loader label={AdminI18n.t('settings.redirects.loadingRedirects')} />;
    }

    if (this.redirects === null) {
      return (
        <div className="p-6">
          <LoadErrorPanel
            title={AdminI18n.t('settings.redirects.redirectsCouldNotBeLoaded')}
            message={this.loadError || AdminI18n.t('settings.redirects.theRedirectsRequestFailed')}
            onRetry={this.retryLoad}
            isRetrying={this.isLoading}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.CornerRightUp size={18} strokeWidth={2} />}
          title={AdminI18n.t('settings.redirects.redirects')}
          subtitle={AdminI18n.t('settings.redirects.sendRetiredUrlsToTheir')}
        />
        <div className="p-6 w-full space-y-6">
          <RedirectCreateCard theme={theme} isSubmitting={this.isCreating} onCreate={this.handleCreate} />
          <RedirectRulesCard
            theme={theme}
            redirects={this.redirects}
            busyId={this.busyId}
            onToggle={this.handleToggle}
            onDelete={this.handleDelete}
          />
        </div>
      </div>
    );
  }
}
