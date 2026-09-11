import { ButtonVariant } from '@fromcode119/sdk/admin';
import type { ReactNode } from 'react';
import { PluginComponent, prop } from '@fromcode119/sdk/react';

import { Button } from '@fromcode119/sdk/admin';
import { Download, GitBranch, Pencil, Play, Trash2 } from 'lucide-react';
import { BuildStatusBadge } from '@plugin/src/ui/build-status-badge';
import { BuildChangelog } from '@plugin/src/ui/build-changelog';

export class BuildSourceListItem extends PluginComponent {
  declare props: {
    build: any; deletingSlug: string | null; onDelete: (slug: string) => void;
    onEdit: (build: any) => void; onTrigger: (slug: string) => void; triggerSlug: string | null;
  };
  @prop build!: any;
  @prop deletingSlug!: string | null;
  @prop onDelete!: (slug: string) => void;
  @prop onEdit!: (build: any) => void;
  @prop onTrigger!: (slug: string) => void;
  @prop triggerSlug!: string | null;

  render(): ReactNode {
    const downloadPath = this.build.fileName
      ? `${this.build.type === 'core' ? '/core' : (this.build.type === 'theme' ? '/themes' : '/plugins')}/${this.build.fileName}`
      : '';
    const tokenLabel = this.build.hasGitSecret
      ? 'Per-source token stored'
      : (this.build.usesEnvToken ? 'Using app-level GITHUB_TOKEN' : 'No token configured');
    const repositoryLabel = String(this.build.gitUrl || '').trim();

    return (
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <GitBranch size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{this.build.slug}</h4>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {this.build.type} • {this.build.branch || 'main'}
                {this.build.version ? ` • v${this.build.version}` : ' • no build yet'}
                {this.build.lastBuildAt ? ` • ${new Date(this.build.lastBuildAt).toLocaleString()}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {this.build.fileName ? `Package: ${this.build.fileName}` : 'Package: waiting for first successful build'}
                {' • '}
                {tokenLabel}
              </p>
              {repositoryLabel ? (
                <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                  Repo: {repositoryLabel}
                </p>
              ) : null}
              {this.build.autoBuild ? (
                <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">
                  Builds automatically{this.build.autoUpdate ? ' and installs each build' : ''}
                </p>
              ) : null}
              <BuildChangelog changelog={this.build.changelog} version={this.build.version} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BuildStatusBadge status={this.build.lastBuildStatus} />
              {downloadPath ? (
                <Button as="a" href={downloadPath} icon={<Download size={12} />} variant={ButtonVariant.GHOST}>
                  Package
                </Button>
              ) : null}
              <Button
                icon={<Play size={12} className={this.triggerSlug === this.build.slug ? 'animate-spin' : ''} />}
                onClick={() => this.onTrigger(this.build.slug)}
                disabled={this.triggerSlug === this.build.slug || this.deletingSlug === this.build.slug}
                variant={ButtonVariant.OUTLINE}
              >
                {this.triggerSlug === this.build.slug ? 'Building' : 'Build'}
              </Button>
              <Button icon={<Pencil size={12} />} onClick={() => this.onEdit(this.build)} variant={ButtonVariant.GHOST}>
                Edit
              </Button>
              <Button
                className="text-slate-400 hover:text-rose-600"
                disabled={this.deletingSlug === this.build.slug}
                icon={<Trash2 size={12} className={this.deletingSlug === this.build.slug ? 'animate-spin' : ''} />}
                onClick={() => this.onDelete(this.build.slug)}
                variant={ButtonVariant.GHOST}
              >
                Remove
              </Button>
            </div>
          </div>
          {this.build.lastBuildStatus === 'failed' && this.build.lastError ? (
            <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
              {this.build.lastError}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}
