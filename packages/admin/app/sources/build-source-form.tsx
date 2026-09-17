import type { ReactNode } from 'react';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Save } from 'lucide-react';
import type { IBuildSourceFormProps } from '@/app/sources/interfaces/build-source-form-props.interface';
import { BuildSourceFormRemote } from '@/app/sources/build-source-form-remote';
import { BuildSourceFormState } from '@/app/sources/build-source-form-state';

/**
 * The form for adding or editing a source.
 *
 * The top of the chain: the lifecycle and the markup. What the form holds and what it reads from the
 * repository live in the links below — see `BuildSourceFormState`.
 */
export class BuildSourceForm extends BuildSourceFormRemote {
  /**
   * An edit dialog opens with a repository already chosen, so it asks straight away.
   *
   * Branches were only ever read on BLUR of the URL field, which a form that opens pre-filled never
   * receives. The branch dropdown therefore opened empty and disabled while stating "No branches
   * could be read" — a claim about the repository for a request that was never made.
   */
  componentDidMount(): void {
    void this.loadProviders();
    if (this.state.gitUrl.trim()) void this.loadBranches();
  }

  componentDidUpdate(prev: IBuildSourceFormProps): void {
    if (prev.build === this.props.build && prev.mode === this.props.mode) return;
    this.setState(BuildSourceFormState.seed(this.props), () => {
      if (this.state.gitUrl.trim()) void this.loadBranches();
    });
  }

  render(): ReactNode {
    return (
      <div>
        <div className="grid gap-4 md:grid-cols-2">
          {/* One option today. Shown anyway: which provider fetches a source is a property of the
              source, and a field that only appears once there are two would make the first one a
              hidden assumption again. */}
          <Select
            label="Provider"
            className="md:col-span-2"
            value={this.state.provider}
            options={this.state.providers.map((entry) => ({ label: entry.label, value: entry.key }))}
            placeholder={this.state.providers.length === 0 ? 'Reading providers…' : 'Select a provider'}
            disabled={this.isEdit || this.state.providers.length <= 1}
            onChange={(value: string) => this.setState({ provider: value })}
          />

          <Input
            label={this.providerDefinition?.locationLabel || 'Location'}
            className="md:col-span-2"
            value={this.state.gitUrl}
            onChange={(event: any) => this.setState({ gitUrl: event.target.value })}
            onBlur={() => { void this.loadBranches(); }}
            placeholder={this.providerDefinition?.locationPlaceholder || ''}
          />

          <Select
            label={this.providerDefinition?.refLabel || 'Version'}
            value={this.state.branch}
            options={this.branchOptions}
            placeholder={this.branchPlaceholder}
            disabled={this.state.branchesLoading || this.state.branches.length === 0}
            onChange={(value: string) => this.onBranchChange(value)}
          />

          {/*
            * Identity, not input. Both come from the manifest in the repository, so they are shown
            * read-only: an operator who could edit them would be creating a second answer to a
            * question the repository has already answered.
            */}
          <Input
            label="Slug"
            value={this.state.slug}
            disabled
            placeholder={this.slugPlaceholder}
          />

          {/* Read from the repository's own manifest, never chosen here. `onChange` is required by
              the component even when disabled; there is nothing for it to do. */}
          <Select
            label="Type"
            value={this.state.type}
            disabled
            onChange={() => undefined}
            options={this.state.types.length ? this.state.types : BuildSourceFormState.TYPES}
          />

          <div className="space-y-2">
            <Input
              label="GitHub Token"
              type="password"
              autoComplete="new-password"
              value={this.state.gitSecret}
              onChange={(event: any) => this.setState({ gitSecret: event.target.value })}
              onBlur={() => { void this.loadBranches(); }}
              placeholder={this.tokenPlaceholder}
            />
            <span className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
              {this.tokenHelpText}
            </span>
          </div>

          {/*
            * Three switches for three different acts, none of them implying another. Building
            * produces a package; installing one that is not there yet is additive; REPLACING code
            * that is currently serving a site is not, and needs its own yes. They used to be two,
            * with installing forced off unless building was automatic — so pressing Build produced
            * a package and left it in the workspace, and no switch could say otherwise.
            */}
          <div className="md:col-span-2 space-y-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
            <Switch
              checked={this.state.autoBuild}
              onChange={(checked: boolean) => this.setState({ autoBuild: checked })}
              label="Build automatically"
              description="Build this source whenever new commits appear on its branch."
            />
            <Switch
              checked={this.state.installAfterBuild}
              onChange={(checked: boolean) => this.setState({ installAfterBuild: checked })}
              label="Install after build"
              description="Put each successful build in place — whether you pressed Build or the schedule did. A theme is installed, not activated."
            />
            {/* DEPENDENT on the switch above, because the code is: the installer is only reached
                inside the `installAfterBuild` branch, so this flag is never consulted while that one
                is off. Left enabled it read as a third independent choice, and turning it on by
                itself did nothing whatsoever — with nothing on screen or in a log to say so. */}
            <Switch
              checked={this.state.autoUpdate}
              onChange={(checked: boolean) => this.setState({ autoUpdate: checked })}
              disabled={!this.state.installAfterBuild}
              label="Update if already installed"
              description={this.state.installAfterBuild
                ? 'Also replace the running version when this extension is already installed.'
                : 'Needs "Install after build" above — nothing is replaced while builds are not installed.'}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button onClick={this.props.onCancel} variant={ButtonVariant.OUTLINE}>
            Cancel
          </Button>
          <Button
            icon={<Save size={16} />}
            isLoading={this.props.busy}
            onClick={() => this.props.onSubmit({
              autoBuild: this.state.autoBuild,
              autoUpdate: this.state.autoUpdate,
              installAfterBuild: this.state.installAfterBuild,
              branch: this.state.branch,
              gitSecret: this.state.gitSecret,
              gitUrl: this.state.gitUrl,
              provider: this.state.provider,
              slug: this.state.slug,
              type: this.state.type,
            })}
            variant={ButtonVariant.SECONDARY}
          >
            {this.isEdit ? 'Save Source' : 'Create Source'}
          </Button>
        </div>
      </div>
    );
  }
}
