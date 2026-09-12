import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { bound, prop, state } from '@fromcode119/react-class-components';

import { Button } from '@/components/ui/view/button.client';
import { Download, GitBranch, Pencil, Play, Trash2 } from 'lucide-react';
import { BuildStatusBadge } from '@/app/sources/build-status-badge';
import { BuildChangelog } from '@/app/sources/build-changelog';
import { SourcesApi } from '@/app/sources/sources-api';

export class BuildSourceListItem extends AdminComponent {
  declare props: {
    build: any; deletingKey: string | null; onDelete: (build: any) => void;
    onEdit: (build: any) => void; onTrigger: (build: any) => void; triggerKey: string | null;
  };
  @prop declare build: any;
  @prop declare deletingKey: string | null;
  @prop declare onDelete: (build: any) => void;
  @prop declare onEdit: (build: any) => void;
  @prop declare onTrigger: (build: any) => void;
  @prop declare triggerKey: string | null;

  @state downloading = false;

  /** This row's identity. A slug alone matches the plugin AND the theme that share it. */
  get identityKey(): string {
    return `${String(this.build?.type ?? '')}/${String(this.build?.slug ?? '')}`;
  }

  /**
   * Fetches the package through the authenticated client and hands the browser the bytes.
   *
   * The archive is made when it is asked for, so this can take a moment on the first press — the
   * button says so rather than appearing to do nothing.
   */
  @bound
  async download(): Promise<void> {
    if (typeof window === 'undefined' || this.downloading) return;
    this.downloading = true;
    try {
      const { blob, filename } = await SourcesApi.downloadPackage(String(this.build.type ?? ''), this.build.slug);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } finally {
      this.downloading = false;
    }
  }

  /**
   * What this source has produced, in the terms the operator asked for it.
   *
   * It used to read the ARCHIVE's filename and say "waiting for first successful build" when there
   * was none — which became a lie the moment a build stopped writing an archive: the build had
   * succeeded, and the screen said it had not happened. The package is the thing; the zip is a
   * download somebody may never ask for.
   */
  get packageLabel(): string {
    if (this.build.fileName) return `Archive: ${this.build.fileName}`;
    const version = String(this.build.version || '').trim();
    if (version && this.build.lastBuildStatus === 'success') {
      return `Package: ${this.build.slug} ${version} — built and ready`;
    }
    return 'Package: waiting for first successful build';
  }

  render(): ReactNode {
    // Offered for any source that has built something. Gated on the VERSION, not on a filename:
    // a build stages a package directory and writes no archive, so gating on a file meant the
    // button appeared only after somebody had already downloaded one.
    const canDownload = Boolean(String(this.build.version || '').trim())
      && this.build.lastBuildStatus === 'success';
    const tokenLabel = this.build.hasGitSecret
      ? 'Per-source token stored'
      : (this.build.usesEnvToken ? 'Using app-level GITHUB_TOKEN' : 'No token configured');
    const repositoryLabel = String(this.build.gitUrl || '').trim();

    // The repository, without the ceremony. Every row said the same 30 characters of
    // `https://github.com/fromcode119/` before the part that differs.
    const repositoryShort = repositoryLabel.replace(/^https?:\/\/(www\.)?/, '').replace(/\.git$/, '');

    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <GitBranch size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {/*
                * ONE line of identity, not five. Twenty sources at 132px each was 2,678px of list in
                * an 822px window — the screen could not show you what you had. Everything below is
                * still here; the facts that repeat on every row (the github.com prefix, the token
                * wording, "builds automatically") stopped taking a line each.
                */}
              <div className="flex min-w-0 items-baseline gap-2">
                <h4 className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">{this.build.slug}</h4>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">{this.build.type}</span>
                <span className="truncate text-[11px] text-slate-500 dark:text-slate-400" title={this.packageLabel}>
                  {this.build.branch || 'main'}
                  {this.build.version ? ` · v${this.build.version}` : ' · no build yet'}
                  {this.build.autoBuild ? ' · auto' : ''}
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-400" title={`${repositoryLabel}\n${tokenLabel}`}>
                {repositoryShort}
              </p>
              <BuildChangelog changelog={this.build.changelog} version={this.build.version} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BuildStatusBadge status={this.build.lastBuildStatus} />
              {canDownload ? (
                <Button
                  onClick={this.download}
                  disabled={this.downloading}
                  icon={<Download size={12} />}
                  variant={ButtonVariant.GHOST}
                >
                  {this.downloading ? 'Packaging…' : 'Package'}
                </Button>
              ) : null}
              <Button
                icon={<Play size={12} className={this.triggerKey === this.identityKey ? 'animate-spin' : ''} />}
                onClick={() => this.onTrigger(this.build)}
                disabled={this.triggerKey === this.identityKey || this.deletingKey === this.identityKey}
                variant={ButtonVariant.OUTLINE}
              >
                {this.triggerKey === this.identityKey ? 'Building' : 'Build'}
              </Button>
              <Button icon={<Pencil size={12} />} onClick={() => this.onEdit(this.build)} variant={ButtonVariant.GHOST}>
                Edit
              </Button>
              <Button
                className="text-slate-400 hover:text-rose-600"
                disabled={this.deletingKey === this.identityKey}
                icon={<Trash2 size={12} className={this.deletingKey === this.identityKey ? 'animate-spin' : ''} />}
                onClick={() => this.onDelete(this.build)}
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
