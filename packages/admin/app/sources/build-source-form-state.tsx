import { ExtensionScope } from '@fromcode119/core/client';
import { Select } from '@/components/ui/view/select.client';
import type { IBuildSourceFormValues } from '@/app/sources/interfaces/build-source-form-values.interface';
import { AdminComponent } from '@/components/view/admin-component.client';
import type { IBuildSourceFormProps } from '@/app/sources/interfaces/build-source-form-props.interface';
import type { IBuildSourceFormState } from '@/app/sources/interfaces/build-source-form-state.interface';
import { SourceEditorMode } from '@/app/sources/enums/source-editor-mode.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the add/edit source form holds, and what each field should say about itself.
 *
 * The base of this form's chain — the remote reads, then the markup.
 *
 * A stored token is never sent back to the browser, so an empty token box on an EDIT means
 * "unchanged", not "cleared" — which is why the help text differs between adding and editing, rather
 * than the field pretending a secret is present.
 */
export abstract class BuildSourceFormState extends AdminComponent<IBuildSourceFormProps, IBuildSourceFormState> {
  /**
   * The kinds this admin knows, derived from the ENUM rather than typed out again.
   *
   * It was a hand-written list saying Plugin/Theme/Core, and it had never heard of an appearance —
   * one of five places the same four strings were spelled by hand. `ExtensionScope` is the
   * declaration; a kind added there appears here without anyone remembering to.
   *
   * Still only a fallback: the authoritative list arrives from the API with the providers, because
   * what THIS installation can build is the server's answer, not the client's.
   */
  protected static readonly TYPES = ExtensionScope.definitions();

  state: IBuildSourceFormState = BuildSourceFormState.seed(this.props);


  protected static seed(props: IBuildSourceFormProps): IBuildSourceFormState {
    const build = props.build;
    return {
      autoBuild: Boolean(build?.autoBuild),
      autoUpdate: Boolean(build?.autoUpdate),
      // A source the form has never seen defaults to installing what it builds; an existing one
      // shows what it stored. `!== false` rather than `Boolean(...)` so a row the migration has not
      // reached yet does not read as "off" on a screen that would then save that.
      installAfterBuild: build ? build.installAfterBuild !== false : true,
      branch: build?.branch || '',
      provider: build?.provider || 'git',
      providers: [],
      types: [],
      branches: [],
      branchesAttempted: false,
      branchesLoading: false,
      branchFailure: '',
      inspecting: false,
      inspectFailed: false,
      inspectFailure: '',
      gitSecret: '',
      gitUrl: build?.gitUrl || '',
      slug: build?.slug || '',
      namespace: build?.namespace || '',
      // The SAME ternary that put an appearance in the dialog as a Plugin, in the other place it
      // was written. Now that the kind is half of which source this is, reading it wrong here would
      // no longer be a wrong label — it would address a different source.
      type: String(ExtensionScope.find(build?.type)?.value ?? ExtensionScope.PLUGIN.value),
    };
  }

  protected get isEdit(): boolean {
    return this.props.mode === SourceEditorMode.EDIT;
  }

  protected get hasStoredToken(): boolean {
    return Boolean(this.props.build?.hasGitSecret);
  }

  protected get tokenHelpText(): string {
    /**
     * The token is what unblocks a private repository, so when reading one failed for want of
     * credentials this field says so — it is the field the operator has to fill in next, and the
     * message belongs where the fix is.
     */
    if (this.state.branchFailure) return this.state.branchFailure;
    if (!this.isEdit) return AdminI18n.t('sources.optionalPrivateRepositoriesNeedA');
    return this.hasStoredToken
      ? AdminI18n.t('sources.aTokenIsAlreadyStored')
      : AdminI18n.t('sources.noTokenIsStoredFor');
  }

  protected get tokenPlaceholder(): string {
    return this.isEdit ? AdminI18n.t('sources.pasteNewTokenToReplace') : AdminI18n.t('sources.optionalPersonalAccessToken');
  }

  /** The chosen provider's definition, or null until the list arrives. */
  protected get providerDefinition(): IBuildSourceFormState['providers'][number] | null {
    return this.state.providers.find((entry) => entry.key === this.state.provider) ?? null;
  }

  /** The vendor field: what the manifest declared, or that it declares none once the repository was read. */
  protected get vendorPlaceholder(): string {
    if (this.state.slug && !this.state.inspecting && !this.state.inspectFailed) return AdminI18n.t('sources.noVendorDeclared');
    return this.slugPlaceholder;
  }

  /** What the identity fields can say before a repository has answered — never a guess. */
  protected get slugPlaceholder(): string {
    if (this.state.inspecting) return AdminI18n.t('sources.readingTheRepository');
    // "Declares no manifest" only when the repository was READ and says nothing; any other failure
    // (refused token, a page opened for another site, an unreachable remote) is the server's own words.
    if (this.state.inspectFailure) return this.state.inspectFailure;
    if (this.state.inspectFailed) return AdminI18n.t('sources.thisRepositoryDeclaresNoExtension');
    return AdminI18n.t('sources.readFromTheRepository');
  }

  protected get branchOptions(): Array<{ label: string; value: string }> {
    return this.state.branches.map((branch) => ({ label: branch, value: branch }));
  }

  /** What the branch field can say when it has nothing to offer — never a guessed name. */
  protected get branchPlaceholder(): string {
    if (this.state.branchesLoading) return AdminI18n.t('sources.readingBranches');
    if (!this.state.gitUrl.trim()) return AdminI18n.t('sources.enterARepositoryUrlFirst');
    if (this.state.branchFailure) return this.state.branchFailure;
    if (!this.state.branchesAttempted) return AdminI18n.t('sources.readingBranches');
    if (this.state.branches.length === 0) return AdminI18n.t('sources.noBranchesCouldBeRead');
    return AdminI18n.t('sources.selectABranch');
  }
}
