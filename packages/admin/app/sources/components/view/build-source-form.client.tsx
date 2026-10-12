import type { ChangeEvent, ReactNode } from 'react';
import { bound } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { Save } from 'lucide-react';
import type { IBuildSourceFormProps } from '@/app/sources/interfaces/build-source-form-props.interface';
import { BuildSourceFormFields } from '@/app/sources/components/view/build-source-form-fields.client';
import { BuildSourceFormState } from '@/app/sources/components/view/build-source-form-state.client';
import { SourceIdentitySummary } from '@/app/sources/components/view/source-identity-summary.client';
import { BuildSourceSwitches } from '@/app/sources/components/view/build-source-switches.client';
import { BuildSourceAdvancedFields } from '@/app/sources/components/view/build-source-advanced-fields.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Adding or editing a source: paste the repository, check what it says it is, pick the branch.
 *
 * The top of the chain — what the form holds is `BuildSourceFormState`, what it reads from the
 * repository `BuildSourceFormRemote`, its handlers `BuildSourceFormFields`.
 */
export class BuildSourceForm extends BuildSourceFormFields {
  /**
   * An edit dialog opens with a repository already chosen, so it asks straight away: branches were
   * once read only on BLUR of the URL field, which a form that opens pre-filled never receives.
   */
  componentDidMount(): void {
    void this.loadProviders();
    void this.loadSites();
    if (this.state.gitUrl.trim()) void this.loadBranches();
  }

  componentDidUpdate(prev: IBuildSourceFormProps): void {
    if (prev.build === this.props.build && prev.mode === this.props.mode) return;
    this.setState(BuildSourceFormState.seed(this.props), () => {
      if (this.state.gitUrl.trim()) void this.loadBranches();
    });
  }

  @bound private handleUrl(event: ChangeEvent<HTMLInputElement>): void {
    this.setState({ gitUrl: event.target.value });
  }

  private renderAdvanced(): ReactNode {
    return (
      <BuildSourceAdvancedFields
        open={this.advancedOpen}
        onToggle={this.toggleAdvanced}
        provider={this.state.provider}
        providerOptions={this.state.providers.map((entry) => ({ label: entry.label, value: entry.key }))}
        providerPlaceholder={this.state.providers.length === 0 ? AdminI18n.t('sources.readingProviders') : AdminI18n.t('sources.selectAProvider')}
        providerDisabled={this.isEdit || this.state.providers.length <= 1}
        onProvider={this.setProvider}
        secret={this.state.gitSecret}
        secretPlaceholder={this.tokenPlaceholder}
        secretHelp={this.tokenHelpText}
        secretSummary={this.tokenSummary}
        onSecret={this.setSecret}
        onSecretBlur={this.rereadBranches}
        publishToSite={this.state.publishToSite}
        siteOptions={this.state.sites}
        onPublish={this.setPublish}
      />
    );
  }

  render(): ReactNode {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Input
          label={this.providerDefinition?.locationLabel || AdminI18n.t('sources.location')}
          value={this.state.gitUrl}
          onChange={this.handleUrl}
          onBlur={this.rereadBranches}
          placeholder={this.providerDefinition?.locationPlaceholder || ''}
        />
        <SourceIdentitySummary detected={this.identityRead} slug={this.state.slug} kind={this.kindLabel} vendor={this.vendorLabel} reading={this.state.inspecting} message={this.slugPlaceholder} />
        <Select
          label={this.providerDefinition?.refLabel || AdminI18n.t('sources.version')}
          value={this.state.branch}
          options={this.branchOptions}
          placeholder={this.branchPlaceholder}
          disabled={this.state.branchesLoading || this.state.branches.length === 0}
          onChange={this.onBranchChange}
        />
        <BuildSourceSwitches
          autoBuild={this.state.autoBuild}
          installAfterBuild={this.state.installAfterBuild}
          autoUpdate={this.state.autoUpdate}
          onAutoBuild={this.setAutoBuild}
          onInstallAfterBuild={this.setInstallAfterBuild}
          onAutoUpdate={this.setAutoUpdate}
        />
        {this.renderAdvanced()}
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button onClick={this.props.onCancel} variant={ButtonVariant.OUTLINE}>{AdminI18n.t('sources.cancel')}</Button>
          <Button icon={<Save size={16} />} isLoading={this.props.busy} onClick={this.submit} variant={ButtonVariant.PRIMARY}>
            {this.isEdit ? AdminI18n.t('sources.saveSource') : AdminI18n.t('sources.createSource')}
          </Button>
        </div>
      </div>
    );
  }
}
