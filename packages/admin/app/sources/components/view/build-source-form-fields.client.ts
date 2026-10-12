import { bound } from '@fromcode119/react-class-components';
import { BuildSourceFormState } from '@/app/sources/components/view/build-source-form-state.client';
import { BuildSourceFormRemote } from '@/app/sources/components/view/build-source-form-remote.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** What each field of the source form does when changed, and the words the summaries show. */
export abstract class BuildSourceFormFields extends BuildSourceFormRemote {
  /** Open when asked, and always while the repository could not be read: the token is the likely fix. */
  protected get advancedOpen(): boolean {
    return this.state.advancedOpen || Boolean(this.state.branchFailure);
  }

  /** Read and declared, for THIS URL: a failed or running read never shows a name. */
  protected get identityRead(): boolean {
    return Boolean(this.state.slug) && !this.state.inspecting && !this.state.inspectFailed;
  }

  /** The detected kind, in the words the server served for it. */
  protected get kindLabel(): string {
    return (this.state.types.length ? this.state.types : BuildSourceFormState.TYPES).find((entry) => entry.value === this.state.type)?.label ?? this.state.type;
  }

  protected get vendorLabel(): string {
    return this.state.namespace || AdminI18n.t('sources.noVendorDeclared');
  }

  /** The token's state for the collapsed Advanced row; an empty box on an edit means "unchanged". */
  protected get tokenSummary(): string {
    if (this.state.gitSecret) return AdminI18n.t('sources.tokenEntered');
    if (this.isEdit && this.hasStoredToken) return AdminI18n.t('sources.tokenStored');
    if (this.isEdit && this.props.build?.usesEnvToken) return AdminI18n.t('sources.usingAppLevelGithubToken');
    return AdminI18n.t('sources.noToken');
  }

  @bound protected toggleAdvanced(): void {
    this.setState({ advancedOpen: !this.advancedOpen });
  }

  @bound protected rereadBranches(): void {
    void this.loadBranches();
  }

  @bound protected setProvider(value: string): void {
    this.setState({ provider: value });
  }

  @bound protected setSecret(value: string): void {
    this.setState({ gitSecret: value });
  }

  @bound protected setPublish(value: string): void {
    this.setState({ publishToSite: value });
  }

  @bound protected setAutoBuild(checked: boolean): void {
    this.setState({ autoBuild: checked });
  }

  @bound protected setInstallAfterBuild(checked: boolean): void {
    this.setState({ installAfterBuild: checked });
  }

  @bound protected setAutoUpdate(checked: boolean): void {
    this.setState({ autoUpdate: checked });
  }

  @bound protected submit(): void {
    this.props.onSubmit({
      autoBuild: this.state.autoBuild,
      autoUpdate: this.state.autoUpdate,
      installAfterBuild: this.state.installAfterBuild,
      publishToSite: this.state.publishToSite,
      branch: this.state.branch,
      gitSecret: this.state.gitSecret,
      gitUrl: this.state.gitUrl,
      provider: this.state.provider,
      slug: this.state.slug,
      type: this.state.type,
    });
  }
}
