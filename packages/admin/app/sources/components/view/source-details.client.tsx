import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { BuildChangelog } from '@/app/sources/components/view/build-changelog.client';
import { SourceVersionsPanel } from '@/app/sources/components/view/source-versions-panel.client';
import type { SourceRow } from '@/app/sources/source-row';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * An opened Sources row: everything the one-line row leaves out. Where the source comes from and
 * with which token, what builds it automatically, where its builds are handed, the last failure,
 * what changed, and its versions.
 */
export class SourceDetails extends PureReactor {
  declare props: Pick<SourceDetails, 'row'>;

  @prop declare row: SourceRow;

  private get tokenLabel(): string {
    const build = this.row.build;
    if (build.hasGitSecret) return AdminI18n.t('sources.perSourceTokenStored');
    return build.usesEnvToken ? AdminI18n.t('sources.usingAppLevelGithubToken') : AdminI18n.t('sources.noTokenConfigured');
  }

  /** The vendor the last build declared; says so when it declared none or no build has recorded it yet. */
  private get vendorLabel(): string {
    const namespace = this.row.build.namespace;
    if (namespace === undefined || namespace === null) return AdminI18n.t('sources.vendorAfterNextBuild');
    return String(namespace).trim() || AdminI18n.t('sources.noVendorDeclared');
  }

  private get automationLabel(): string {
    const build = this.row.build;
    const parts = [build.autoBuild ? AdminI18n.t('sources.buildAutomatically') : AdminI18n.t('sources.buildsOnlyOnRequest')];
    if (build.installAfterBuild !== false) parts.push(AdminI18n.t('sources.installAfterBuild'));
    return parts.join(', ');
  }

  private renderFact(label: string, value: ReactNode): ReactNode {
    return (
      <div className="min-w-0">
        <dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt>
        <dd className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-200">{value}</dd>
      </div>
    );
  }

  /** Where builds are handed, and what happened last time, without opening the target site. */
  private renderPublish(): ReactNode {
    const build = this.row.build;
    if (!build.publishToSite) return AdminI18n.t('sources.publishToSiteOff');
    return (
      <>
        <span className="block truncate">{build.publishToSite}</span>
        <span className="block whitespace-normal text-[11px] font-normal text-slate-500 dark:text-slate-400">{build.lastPublish || AdminI18n.t('sources.notPublishedYet')}</span>
      </>
    );
  }

  render(): ReactNode {
    const { row } = this;
    return (
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
          {this.renderFact(AdminI18n.t('sources.repository'), <span title={row.build.gitUrl}>{row.repository}</span>)}
          {this.renderFact(AdminI18n.t('sources.githubToken'), this.tokenLabel)}
          {this.renderFact(AdminI18n.t('sources.vendor'), <span title={AdminI18n.t('sources.vendorHelp')}>{this.vendorLabel}</span>)}
          {this.renderFact(AdminI18n.t('sources.automation'), this.automationLabel)}
          {this.renderFact(AdminI18n.t('sources.publishToSite'), this.renderPublish())}
        </dl>
        {row.status === 'failed' && row.build.lastError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
            {row.build.lastError}
          </div>
        ) : null}
        <BuildChangelog changelog={row.build.changelog} version={row.version} />
        <SourceVersionsPanel build={row.build} />
      </div>
    );
  }
}
