import { ExtensionScope } from '@fromcode119/core/client';
import type { IBuildSourceFormValues } from '@/app/sources/interfaces/build-source-form-values.interface';
import { SourcesApi } from '@/app/sources/sources-api';
import { BuildSourceFormState } from '@/app/sources/build-source-form-state';

/**
 * Asking the repository itself what it contains, before a source for it exists.
 *
 * Branches come from the remote and the declared kind comes from its own manifest, so the form states
 * what the repository IS rather than asking the operator to assert it. An empty answer is reported as
 * an empty answer — the branch field never falls back to offering "main" for a repository nothing
 * could read.
 *
 * Picking a branch re-inspects, because the manifest is a property of the BRANCH: a repository can
 * be a theme on one and something else entirely on another.
 */
export abstract class BuildSourceFormRemote extends BuildSourceFormState {
  /**
   * What this installation can fetch source from.
   *
   * Asked rather than hardcoded: the provider list is the server's to state, and a field built from
   * a literal here would drift the moment one is added.
   */
  protected async loadProviders(): Promise<void> {
    try {
      const response: any = await SourcesApi.providers();
      const providers = Array.isArray(response?.providers) ? response.providers : [];
      const types = Array.isArray(response?.types) ? response.types : [];
      this.setState({ providers, types });
    } catch {
      // The form still works: a source that names no provider is tracked with the default, and the
      // field simply has nothing to offer rather than inventing an option.
      this.setState({ providers: [], types: [] });
    }
  }

  /**
   * What a remote-reading call needs to authenticate.
   *
   * An existing source carries its slug so the server can fall back to the token it already holds —
   * the stored secret is deliberately never sent to the browser, so this form has nothing to send
   * until the operator types a replacement.
   */
  protected remoteReadPayload(fields: Record<string, unknown>): Record<string, unknown> {
    const payload: Record<string, unknown> = { ...fields, gitSecret: this.state.gitSecret };
    // BOTH halves, because the stored token belongs to one source: the server refuses to look one
    // up from a slug alone now, and sending only the slug silently lost the credential for every
    // private repository opened for editing.
    if (this.isEdit && this.props.build?.slug) {
      payload.slug = this.props.build.slug;
      payload.type = this.props.build.type;
    }
    return payload;
  }

  /**
   * Asks the remote what branches it has, when there is a URL to ask about.
   *
   * On blur rather than on every keystroke: this is a network call to somebody's git host, and a
   * half-typed URL is not a question worth asking.
   */
  protected async loadBranches(): Promise<void> {
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
      response = await SourcesApi.listBranches(this.remoteReadPayload({ gitUrl }));
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
  protected async inspect(branch: string): Promise<void> {
    const gitUrl = this.state.gitUrl.trim();
    if (!gitUrl || !branch) return;

    this.setState({ inspecting: true, inspectFailed: false });
    let response: any = null;
    try {
      response = await SourcesApi.inspect(this.remoteReadPayload({ gitUrl, branch }));
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
      type: this.declaredType(declared.type),
    });
  }

  /**
   * The kind the SERVER read from the repository's own manifest.
   *
   * This was a ternary chain that knew `core` and `theme` and mapped everything else to `plugin` —
   * so `appearance-hub`, whose `appearance.json` the reader identified correctly, arrived in the
   * dialog as a Plugin. The detection was right; the form threw the answer away.
   *
   * Checked against the list the API serves rather than a set spelled out here again: that list
   * comes from `BuildSourceType`, so a kind the platform can build is a kind this form can show,
   * without a fourth copy to keep in step.
   */
  protected declaredType(declared: unknown): string {
    // `find` returns null for a kind this build does not know, rather than quietly calling it a
    // plugin — which is precisely what the ternary it replaces did to every appearance.
    const scope = ExtensionScope.find(declared);
    if (scope) return String(scope.value);

    // The server may know a kind this admin does not; trust its list before falling back.
    const value = String(declared ?? '').trim();
    const served = this.state.types.some((entry) => entry.value === value);
    return served ? value : String(ExtensionScope.PLUGIN.value);
  }

  protected onBranchChange(branch: string): void {
    this.setState({ branch });
    void this.inspect(branch);
  }
}
