import { SourcesApi } from '@/app/sources/sources-api';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { state } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { GitBranch, Hammer, Play, RefreshCw } from 'lucide-react';
import { BuildOverviewHistory } from '@/app/sources/build-overview-history';
import { BuildOverviewStats } from '@/app/sources/build-overview-stats';
import { BuildSourceDialog } from '@/app/sources/build-source-dialog';
import { BuildSourceForm } from '@/app/sources/build-source-form';
import type { IBuildSourceFormValues } from '@/app/sources/interfaces/build-source-form-values.interface';
import type { IBuildOverviewState } from '@/app/sources/interfaces/build-overview-state.interface';

export class BuildOverview extends AdminComponent {
  @state builds: any[] = [];
  // Holds `<kind>/<slug>`, not a slug: the same slug can name a plugin AND a theme, and a
  // slug-only comparison spun the Delete button on both rows.
  @state deletingKey: string | null = null;
  @state editingBuild: any | null = null;
  @state editorMode: 'create' | 'edit' | null = null;
  @state error: string = '';
  @state loading: boolean = true;
  @state savingSource: boolean = false;
  @state triggerKey: string | null = null;
  @state triggering: boolean = false;
  @state checking: boolean = false;
  static slots = ['admin.plugin.sources.content', 'admin.plugin.sources.overview', 'admin.plugin.sources.page.sources'];
  private interval: ReturnType<typeof setInterval> | null = null;

  componentDidMount(): void {
    this.loadBuilds();
    this.interval = setInterval(() => this.loadBuilds(), 10000);
  }

  componentWillUnmount(): void {
    if (this.interval) clearInterval(this.interval);
  }

  async loadBuilds(): Promise<void> {
    try {
      const res = await SourcesApi.list({ silent: true });
      this.builds = res?.builds || [];
      this.error = '';
    } catch (err: any) {
      this.error = err?.message || 'Failed to load builds';
    } finally {
      this.loading = false;
    }
  }

  closeEditor(): void {
    this.editingBuild = null;
    this.editorMode = null;
  }

  async handleCheckUpdates(): Promise<void> {
    this.checking = true;
    try {
      await SourcesApi.checkUpdates();
      await this.loadBuilds();
    } catch (err: any) {
      this.error = err?.message || 'Update check failed';
    } finally {
      this.checking = false;
    }
  }

  async handleDelete(build: any): Promise<void> {
    const { type, slug } = BuildOverview.identify(build);
    if (!window.confirm(`Are you sure you want to remove the ${type} "${slug}"? This stops tracking the repository but keeps existing packages.`)) {
      return;
    }
    this.deletingKey = `${type}/${slug}`;
    try {
      await SourcesApi.remove(type, slug);
      await this.loadBuilds();
      if (this.editingBuild?.slug === slug && this.editingBuild?.type === type) this.closeEditor();
    } catch (err: any) {
      this.error = err?.message || `Failed to delete ${slug}`;
    } finally {
      this.deletingKey = null;
    }
  }

  async handleSaveSource(values: IBuildSourceFormValues): Promise<void> {
    this.savingSource = true;
    try {
      if (this.editorMode === 'edit' && this.editingBuild?.slug) {
        const { type, slug } = BuildOverview.identify(this.editingBuild);
        // The kind is not sent: it is half of WHICH source this is, and changing it would move the
        // clone directory, the staging root and the installer. That is a new source, not an edit.
        const { type: _kind, ...editable } = values as unknown as Record<string, unknown>;
        await SourcesApi.update(type, slug, editable);
      } else {
        await SourcesApi.create({ ...values });
      }
      this.closeEditor();
      await this.loadBuilds();
    } catch (err: any) {
      this.error = err?.message || 'Failed to save build source';
    } finally {
      this.savingSource = false;
    }
  }

  async handleTriggerAll(): Promise<void> {
    this.triggering = true;
    try {
      await SourcesApi.buildAll();
      await this.loadBuilds();
    } catch (err: any) {
      this.error = err?.message || 'Build trigger failed';
    } finally {
      this.triggering = false;
    }
  }

  async handleTriggerOne(build: any): Promise<void> {
    const { type, slug } = BuildOverview.identify(build);
    this.triggerKey = `${type}/${slug}`;
    try {
      await SourcesApi.buildOne(type, slug);
      await this.loadBuilds();
    } catch (err: any) {
      this.error = err?.message || `Build failed for ${slug}`;
    } finally {
      this.triggerKey = null;
    }
  }

  /** A row's identity, in the one shape every call site here needs. */
  private static identify(build: any): { type: string; slug: string } {
    return { type: String(build?.type ?? ''), slug: String(build?.slug ?? '') };
  }

  render(): ReactNode {
    const { builds, checking, deletingKey, editingBuild, editorMode, error, loading, savingSource, triggerKey, triggering } = this;
    const editorTitle = editorMode === 'edit' ? `Edit ${editingBuild?.slug || 'source'}` : 'Add Build Source';
    const editorDescription = editorMode === 'edit'
      ? 'Update repository details here. Leave the token blank to keep the currently stored secret.'
      : 'Track a plugin or theme repository in a focused dialog without disrupting the build list.';

    return (
      <>
        {/*
          * No padding on the ROOT. The sticky header is a direct child so it spans the full content
          * column and sits flat against the divider, the way every other screen's header does
          * (see plugins/layout.client.tsx). With padding here the bar was inset on all sides and
          * read as a floating panel — the one header in the admin shaped like a card.
          */}
        <div className="w-full">
          <CompactPageHeader
            title="Sources"
            subtitle="The repositories this platform builds from — plugins, themes, and the framework itself."
            icon={<Hammer size={20} />}
            actions={(
              <div className="flex items-center gap-2">
                <Button icon={<GitBranch size={14} />} onClick={() => { this.editorMode = 'create'; this.editingBuild = null; }} variant={ButtonVariant.PRIMARY}>
                  Add Source
                </Button>
                <Button disabled={checking} icon={<RefreshCw size={14} className={checking ? 'animate-spin' : ''} />} onClick={() => this.handleCheckUpdates()} variant={ButtonVariant.OUTLINE}>
                  {checking ? 'Checking…' : 'Check Updates'}
                </Button>
                <Button disabled={triggering} icon={<Play size={14} />} onClick={() => this.handleTriggerAll()} variant={ButtonVariant.SECONDARY}>
                  {triggering ? 'Building…' : 'Build All'}
                </Button>
              </div>
            )}
          />

          <div className="space-y-4 p-4 lg:p-6">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          ) : null}

          <BuildOverviewStats builds={builds} loading={loading} />

          <BuildOverviewHistory
            builds={builds}
            deletingKey={deletingKey}
            loading={loading}
            onDelete={(build: any) => this.handleDelete(build)}
            onEdit={(nextBuild: any) => { this.editingBuild = nextBuild; this.editorMode = 'edit'; }}
            onTrigger={(build: any) => this.handleTriggerOne(build)}
            triggerKey={triggerKey}
          />
          </div>
        </div>

        {editorMode ? (
          <BuildSourceDialog description={editorDescription} onClose={() => this.closeEditor()} title={editorTitle}>
            <BuildSourceForm build={editingBuild} busy={savingSource} mode={editorMode} onCancel={() => this.closeEditor()} onSubmit={(values) => this.handleSaveSource(values)} />
          </BuildSourceDialog>
        ) : null}
      </>
    );
  }
}
