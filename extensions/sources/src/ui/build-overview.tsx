import { ButtonVariant } from '@fromcode119/sdk/admin';
import type { ReactNode } from 'react';
import { PluginComponent, state } from '@fromcode119/sdk/react';
import { Button, PluginPageHeader } from '@fromcode119/sdk/admin';
import { GitBranch, Hammer, Play, RefreshCw } from 'lucide-react';
import { BuildOverviewHistory } from '@plugin/src/ui/build-overview-history';
import { BuildOverviewStats } from '@plugin/src/ui/build-overview-stats';
import { BuildSourceDialog } from '@plugin/src/ui/build-source-dialog';
import { BuildSourceForm } from '@plugin/src/ui/build-source-form';
import type { IBuildOverviewState } from '@plugin/src/ui/interfaces/build-overview-state.interface';

export class BuildOverview extends PluginComponent {
  @state builds: any[] = [];
  @state deletingSlug: string | null = null;
  @state editingBuild: any | null = null;
  @state editorMode: 'create' | 'edit' | null = null;
  @state error: string = '';
  @state loading: boolean = true;
  @state savingSource: boolean = false;
  @state triggerSlug: string | null = null;
  @state triggering: boolean = false;
  @state checking: boolean = false;
  static slots = ['admin.plugin.sources.content', 'admin.plugin.sources.overview', 'admin.plugin.sources.page.sources'];
  private interval: ReturnType<typeof setInterval> | null = null;

  protected get api(): any {
    return this.namespace('org.fromcode')['sources'];
  }

  componentDidMount(): void {
    this.loadBuilds();
    this.interval = setInterval(() => this.loadBuilds(), 10000);
  }

  componentWillUnmount(): void {
    if (this.interval) clearInterval(this.interval);
  }

  async loadBuilds(): Promise<void> {
    try {
      const res = await this.api.getStatus({ silent: true });
      this.setState({ builds: res?.builds || [], error: '' });
    } catch (err: any) {
      this.setState({ error: err?.message || 'Failed to load builds' });
    } finally {
      this.setState({ loading: false });
    }
  }

  closeEditor(): void {
    this.setState({ editingBuild: null, editorMode: null });
  }

  async handleCheckUpdates(): Promise<void> {
    this.setState({ checking: true });
    try {
      await this.api.checkUpdates();
      await this.loadBuilds();
    } catch (err: any) {
      this.setState({ error: err?.message || 'Update check failed' });
    } finally {
      this.setState({ checking: false });
    }
  }

  async handleDelete(slug: string): Promise<void> {
    if (!window.confirm(`Are you sure you want to remove "${slug}"? This stops tracking the repository but keeps existing packages.`)) {
      return;
    }
    this.setState({ deletingSlug: slug });
    try {
      await this.api.deleteSource(slug);
      await this.loadBuilds();
      if (this.editingBuild?.slug === slug) this.closeEditor();
    } catch (err: any) {
      this.setState({ error: err?.message || `Failed to delete ${slug}` });
    } finally {
      this.setState({ deletingSlug: null });
    }
  }

  async handleSaveSource(values: { branch: string; gitSecret: string; gitUrl: string; slug: string; type: 'plugin' | 'theme' | 'core' }): Promise<void> {
    this.setState({ savingSource: true });
    try {
      if (this.editorMode === 'edit' && this.editingBuild?.slug) {
        await this.api.updateSource(this.editingBuild.slug, values);
      } else {
        await this.api.createSource(values);
      }
      this.closeEditor();
      await this.loadBuilds();
    } catch (err: any) {
      this.setState({ error: err?.message || 'Failed to save build source' });
    } finally {
      this.setState({ savingSource: false });
    }
  }

  async handleTriggerAll(): Promise<void> {
    this.setState({ triggering: true });
    try {
      await this.api.triggerAll();
      await this.loadBuilds();
    } catch (err: any) {
      this.setState({ error: err?.message || 'Build trigger failed' });
    } finally {
      this.setState({ triggering: false });
    }
  }

  async handleTriggerOne(slug: string): Promise<void> {
    this.setState({ triggerSlug: slug });
    try {
      await this.api.triggerOne(slug);
      await this.loadBuilds();
    } catch (err: any) {
      this.setState({ error: err?.message || `Build failed for ${slug}` });
    } finally {
      this.setState({ triggerSlug: null });
    }
  }

  render(): ReactNode {
    const { builds, checking, deletingSlug, editingBuild, editorMode, error, loading, savingSource, triggerSlug, triggering } = this;
    const editorTitle = editorMode === 'edit' ? `Edit ${editingBuild?.slug || 'source'}` : 'Add Build Source';
    const editorDescription = editorMode === 'edit'
      ? 'Update repository details here. Leave the token blank to keep the currently stored secret.'
      : 'Track a plugin or theme repository in a focused dialog without disrupting the build list.';

    return (
      <>
        <div className="space-y-5 p-6 lg:p-8">
          <PluginPageHeader
            title="Sources"
            subtitle="The repositories this platform builds from — plugins, themes, and the framework itself."
            icon={<Hammer size={20} />}
            actions={(
              <div className="flex items-center gap-2">
                <Button icon={<GitBranch size={14} />} onClick={() => this.setState({ editorMode: 'create', editingBuild: null })} variant={ButtonVariant.PRIMARY}>
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

          {error ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          ) : null}

          <BuildOverviewStats builds={builds} loading={loading} />

          <BuildOverviewHistory
            builds={builds}
            deletingSlug={deletingSlug}
            loading={loading}
            onDelete={(slug: string) => this.handleDelete(slug)}
            onEdit={(nextBuild: any) => this.setState({ editingBuild: nextBuild, editorMode: 'edit' })}
            onTrigger={(slug: string) => this.handleTriggerOne(slug)}
            triggerSlug={triggerSlug}
          />
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
