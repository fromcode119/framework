import type { ReactNode } from 'react';
import { Button, ButtonVariant, Input, Select, Switch } from '@fromcode119/sdk/admin';
import { PluginComponent } from '@fromcode119/sdk/react';
import { Save } from 'lucide-react';
import type { IBuildSourceFormProps } from '@plugin/src/ui/interfaces/build-source-form-props.interface';
import type { IBuildSourceFormState } from '@plugin/src/ui/interfaces/build-source-form-state.interface';

/**
 * Create/edit form for a build source, built from the admin's OWN controls.
 *
 * It used to be raw `<input>` and `<select>` elements with a hand-written class string, so the type
 * field opened the operating system's dropdown in the middle of the admin — a different font, a
 * different palette, and none of the admin's keyboard behaviour.
 *
 * Two fields also asked for things the repository already knows, and asking created a second source
 * of truth that could only ever disagree. The branch is chosen from what the remote actually has,
 * rather than typed against a default of "main" that is wrong for every repository whose default is
 * `master`. The slug and type are READ FROM THE EXTENSION'S OWN MANIFEST — they are its identity,
 * they name the built package and the tables it owns, and they are already declared in the file the
 * build will read anyway. A repository that declares nothing is reported as such; nothing is
 * guessed from the URL, because a repository called `fromcode-plugin-forms` may ship anything.
 */
export class BuildSourceForm extends PluginComponent<IBuildSourceFormProps, IBuildSourceFormState> {
  private static readonly TYPES = [
    { label: 'Plugin', value: 'plugin' },
    { label: 'Theme', value: 'theme' },
    { label: 'Core', value: 'core' },
  ];

  state: IBuildSourceFormState = BuildSourceForm.seed(this.props);

  /**
   * This plugin's own client, the same one the page around this form uses.
   *
   * `PluginComponent.api` is the generic accessor and carries none of this plugin's methods, so
   * calling `listBranches` on it threw before a request was ever made — the branch field sat on
   * "Reading branches…" forever with nothing in the console and nothing on the network.
   */
  protected get api(): any {
    return this.namespace('org.fromcode')['sources'];
  }

  private static seed(props: IBuildSourceFormProps): IBuildSourceFormState {
    const build = props.build;
    return {
      autoBuild: Boolean(build?.autoBuild),
      autoUpdate: Boolean(build?.autoUpdate),
      branch: build?.branch || '',
      branches: [],
      branchesAttempted: false,
      branchesLoading: false,
      branchFailure: '',
      inspecting: false,
      inspectFailed: false,
      gitSecret: '',
      gitUrl: build?.gitUrl || '',
      slug: build?.slug || '',
      type: build?.type === 'core' ? 'core' : (build?.type === 'theme' ? 'theme' : 'plugin'),
    };
  }

  /**
   * An edit dialog opens with a repository already chosen, so it asks straight away.
   *
   * Branches were only ever read on BLUR of the URL field, which a form that opens pre-filled never
   * receives. The branch dropdown therefore opened empty and disabled while stating "No branches
   * could be read" — a claim about the repository for a request that was never made.
   */
  componentDidMount(): void {
    if (this.state.gitUrl.trim()) void this.loadBranches();
  }

  componentDidUpdate(prev: IBuildSourceFormProps): void {
    if (prev.build === this.props.build && prev.mode === this.props.mode) return;
    this.setState(BuildSourceForm.seed(this.props), () => {
      if (this.state.gitUrl.trim()) void this.loadBranches();
    });
  }

  private get isEdit(): boolean {
    return this.props.mode === 'edit';
  }

  private get hasStoredToken(): boolean {
    return Boolean(this.props.build?.hasGitSecret);
  }

  private get tokenHelpText(): string {
    /**
     * The token is what unblocks a private repository, so when reading one failed for want of
     * credentials this field says so — it is the field the operator has to fill in next, and the
     * message belongs where the fix is.
     */
    if (this.state.branchFailure) return this.state.branchFailure;
    if (!this.isEdit) return 'Optional. Private repositories need a token; public repositories can stay blank.';
    return this.hasStoredToken
      ? 'A token is already stored securely. Paste a new token only if you want to replace it.'
      : 'No token is stored for this source. Leave blank to use the server GITHUB_TOKEN.';
  }

  private get tokenPlaceholder(): string {
    return this.isEdit ? 'Paste new token to replace stored token' : 'Optional personal access token';
  }

  /**
   * What a remote-reading call needs to authenticate.
   *
   * An existing source carries its slug so the server can fall back to the token it already holds —
   * the stored secret is deliberately never sent to the browser, so this form has nothing to send
   * until the operator types a replacement.
   */
  private remoteReadPayload(fields: Record<string, unknown>): Record<string, unknown> {
    const payload: Record<string, unknown> = { ...fields, gitSecret: this.state.gitSecret };
    if (this.isEdit && this.props.build?.slug) payload.slug = this.props.build.slug;
    return payload;
  }

  /**
   * Asks the remote what branches it has, when there is a URL to ask about.
   *
   * On blur rather than on every keystroke: this is a network call to somebody's git host, and a
   * half-typed URL is not a question worth asking.
   */
  private async loadBranches(): Promise<void> {
    const gitUrl = this.state.gitUrl.trim();
    if (!gitUrl) {
      this.setState({ branches: [], branchesAttempted: false });
      return;
    }

    this.setState({ branchesLoading: true });
    // try/finally, not a catch on the promise: a call that throws BEFORE returning one skips the
    // catch entirely, and the field then sits on "Reading branches…" for the rest of the session.
    let response: any = null;
    let failure = '';
    try {
      response = await this.api.listBranches(this.remoteReadPayload({ gitUrl }));
    } catch (error: any) {
      // The server's own words — it knows whether git is missing or the remote refused.
      failure = String(error?.message || error?.error || '').trim();
      response = null;
    }

    const branches: string[] = Array.isArray(response?.branches) ? response.branches : [];
    // Only adopt a branch the remote actually reported; never invent one. The one thing that must
    // survive a failed read is a branch this source is ALREADY tracking: clearing it turned a
    // temporary inability to reach the remote into a saved change to what gets built.
    const branch = branches.length === 0
      ? this.state.branch
      : (branches.includes(this.state.branch)
        ? this.state.branch
        : (branches.includes('main') ? 'main' : branches[0]));

    this.setState({ branches, branchesAttempted: true, branchesLoading: false, branch, branchFailure: failure });
    if (branch) await this.inspect(branch);
  }

  /**
   * Reads the repository's manifest for what it declares itself to be.
   *
   * Runs whenever the branch changes, because a branch can rename or retype an extension, and the
   * source being created tracks THAT branch.
   */
  private async inspect(branch: string): Promise<void> {
    const gitUrl = this.state.gitUrl.trim();
    if (!gitUrl || !branch) return;

    this.setState({ inspecting: true, inspectFailed: false });
    let response: any = null;
    try {
      response = await this.api.inspectSource(this.remoteReadPayload({ gitUrl, branch }));
    } catch {
      response = null;
    }

    const declared = response?.declared;
    if (!declared?.slug) {
      this.setState({ inspecting: false, inspectFailed: true });
      return;
    }

    this.setState({
      inspecting: false,
      inspectFailed: false,
      slug: String(declared.slug),
      type: declared.type === 'core' ? 'core' : (declared.type === 'theme' ? 'theme' : 'plugin'),
    });
  }

  private onBranchChange(branch: string): void {
    this.setState({ branch });
    void this.inspect(branch);
  }

  /** What the identity fields can say before a repository has answered — never a guess. */
  private get slugPlaceholder(): string {
    if (this.state.inspecting) return 'Reading the repository…';
    if (this.state.inspectFailed) return 'This repository declares no extension manifest';
    return 'Read from the repository';
  }

  private get branchOptions(): Array<{ label: string; value: string }> {
    return this.state.branches.map((branch) => ({ label: branch, value: branch }));
  }

  /** What the branch field can say when it has nothing to offer — never a guessed name. */
  private get branchPlaceholder(): string {
    if (this.state.branchesLoading) return 'Reading branches…';
    if (!this.state.gitUrl.trim()) return 'Enter a repository URL first';
    if (this.state.branchFailure) return this.state.branchFailure;
    if (!this.state.branchesAttempted) return 'Reading branches…';
    if (this.state.branches.length === 0) return 'No branches could be read';
    return 'Select a branch';
  }

  render(): ReactNode {
    return (
      <div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Git URL"
            className="md:col-span-2"
            value={this.state.gitUrl}
            onChange={(event: any) => this.setState({ gitUrl: event.target.value })}
            onBlur={() => { void this.loadBranches(); }}
            placeholder="https://github.com/org/repo.git"
          />

          <Select
            label="Branch"
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

          <Select
            label="Type"
            value={this.state.type}
            disabled
            options={BuildSourceForm.TYPES}
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
            * Two switches, not one. Building produces a file; installing REPLACES code that is
            * serving a site. Collapsing them into "keep this up to date" would hide the second act
            * behind consent given for the first, so installing is its own choice and is only
            * offered once building is automatic — there is nothing to install otherwise.
            */}
          <div className="md:col-span-2 space-y-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
            <Switch
              checked={this.state.autoBuild}
              onChange={(checked: boolean) => this.setState({
                autoBuild: checked,
                autoUpdate: checked ? this.state.autoUpdate : false,
              })}
              label="Build automatically"
              description="Build this source whenever new commits appear on its branch."
            />
            <Switch
              checked={this.state.autoUpdate}
              disabled={!this.state.autoBuild}
              onChange={(checked: boolean) => this.setState({ autoUpdate: checked })}
              label="Install automatically"
              description="Install each successful build immediately, replacing the running version."
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
              branch: this.state.branch,
              gitSecret: this.state.gitSecret,
              gitUrl: this.state.gitUrl,
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
