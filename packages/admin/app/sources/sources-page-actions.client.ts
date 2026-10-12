import { bound } from '@fromcode119/react-class-components';
import { SourcesApi } from '@/app/sources/sources-api';
import { SourcesPageState } from '@/app/sources/sources-page-state.client';
import { SourceUpdateSummary } from '@/app/sources/source-update-summary';
import { SourceStatusFilter } from '@/app/sources/enums/source-status-filter.enum';
import { SourceEditorMode } from '@/app/sources/enums/source-editor-mode.enum';
import type { SourceRow } from '@/app/sources/source-row';
import type { IBuildSourceFormValues } from '@/app/sources/interfaces/build-source-form-values.interface';
import type { ListFilter } from '@/components/ui/list-toolbar/list-filter';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** What the Sources screen can do. The list is polled, so every action ends by reloading it. */
export abstract class SourcesPageActions extends SourcesPageState {
  componentDidMount(): void {
    void this.loadBuilds();
    const interval = setInterval(() => { void this.loadBuilds(); }, 10000);
    this.onUnmount(() => clearInterval(interval));
  }

  protected get filters(): ListFilter[] {
    return this.query.filters(this.rows, this.updateCheck !== null, this.setType, this.setStatus);
  }

  async loadBuilds(): Promise<void> {
    try {
      const res = await SourcesApi.list({ silent: true });
      this.builds = res?.builds || [];
      this.error = '';
    } catch (err: any) {
      this.error = err?.message || AdminI18n.t('sources.failedToLoadBuilds');
    } finally {
      this.loading = false;
    }
  }

  @bound setSearch(value: string): void {
    this.search = value;
    this.page = 1;
  }

  @bound setType(value: string): void {
    this.typeFilter = value;
    this.page = 1;
  }

  @bound setStatus(value: string): void {
    this.statusFilter = SourceStatusFilter.resolve(value);
    this.page = 1;
  }

  @bound setPage(page: number): void {
    this.page = page;
  }

  @bound toggleRow(row: SourceRow): void {
    this.openId = this.openId === row.id ? null : row.id;
  }

  /** Keeps the answer: it is what marks each row that has commits waiting, and offers that filter. */
  @bound async checkUpdates(): Promise<void> {
    this.checking = true;
    try {
      const check = await SourcesApi.checkUpdates();
      this.updateCheck = check;
      await this.loadBuilds();
      const summary = new SourceUpdateSummary(check, this.builds);
      this.runtime.notify.addNotification({ title: summary.title, message: summary.message, type: summary.hasUpdates ? NotificationType.INFO : NotificationType.SUCCESS });
    } catch (err: any) {
      this.error = err?.message || AdminI18n.t('sources.updateCheckFailed');
    } finally {
      this.checking = false;
    }
  }

  @bound async buildAll(): Promise<void> {
    this.triggering = true;
    try {
      await SourcesApi.buildAll();
      await this.loadBuilds();
    } catch (err: any) {
      this.error = err?.message || AdminI18n.t('sources.buildTriggerFailed');
    } finally {
      this.triggering = false;
    }
  }

  @bound async buildOne(row: SourceRow): Promise<void> {
    this.buildingId = row.id;
    try {
      await SourcesApi.buildOne(row.type, row.slug);
      await this.loadBuilds();
    } catch (err: any) {
      this.error = err?.message || AdminI18n.t('sources.buildFailedFor', { slug: row.slug });
    } finally {
      this.buildingId = null;
    }
  }

  @bound requestRemove(row: SourceRow): void {
    this.removing = row;
  }

  @bound cancelRemove(): void {
    if (!this.removeBusy) this.removing = null;
  }

  @bound async confirmRemove(): Promise<void> {
    const row = this.removing;
    if (!row) return;
    this.removeBusy = true;
    try {
      await SourcesApi.remove(row.type, row.slug);
      if (this.openId === row.id) this.openId = null;
      if (this.editingBuild && `${this.editingBuild.type}/${this.editingBuild.slug}` === row.id) this.closeEditor();
      await this.loadBuilds();
    } catch (err: any) {
      this.error = err?.message || AdminI18n.t('sources.failedToDelete', { slug: row.slug });
    } finally {
      this.removeBusy = false;
      this.removing = null;
    }
  }

  @bound openCreate(): void {
    this.editingBuild = null;
    this.editorMode = SourceEditorMode.CREATE;
  }

  @bound openEdit(row: SourceRow): void {
    this.editingBuild = row.build;
    this.editorMode = SourceEditorMode.EDIT;
  }

  @bound closeEditor(): void {
    this.editingBuild = null;
    this.editorMode = null;
    this.editorError = '';
  }

  @bound async saveSource(values: IBuildSourceFormValues): Promise<void> {
    this.savingSource = true;
    this.editorError = '';
    try {
      if (this.editorMode === SourceEditorMode.EDIT && this.editingBuild?.slug) {
        // The kind is not sent: it is half of WHICH source this is, and changing it would move the
        // clone directory, the staging root and the installer. That is a new source, not an edit.
        const { type: _kind, ...editable } = values as unknown as Record<string, unknown>;
        await SourcesApi.update(String(this.editingBuild.type ?? ''), String(this.editingBuild.slug), editable);
      } else {
        await SourcesApi.create({ ...values });
      }
      this.closeEditor();
      await this.loadBuilds();
    } catch (err: any) {
      this.editorError = err?.message || AdminI18n.t('sources.failedToSaveBuildSource');
    } finally {
      this.savingSource = false;
    }
  }
}
