import { RadioGroup } from '@/components/ui/view/radio-group.client';
import { ListCard } from '@/components/ui/view/list-card.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { Card } from '@/components/ui/view/card.client';
import { Select } from '@/components/ui/view/select.client';
import { FrameworkIcons } from '@fromcode119/react';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { SettingsSaveBar } from '@/components/ui/view/settings-save-bar.client';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { SettingsPageScope } from '@/lib/settings/settings-page-scope';
import { SiteScopePanel } from '@/components/view/site-scope-panel.client';
import { RoutingPageActions } from '@/app/settings/routing/page-actions.client';
import { RoutingPageState } from '@/app/settings/routing/page-state.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Input } from '@/components/ui/view/input.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';

/**
 * Routing — the permalink structure and what the home page serves.
 *
 * The top of the chain: the lifecycle and the markup. What the page knows, how it resolves the
 * current home target and what it can save live in the links below — see `RoutingPageState`.
 */
export class RoutingPage extends RoutingPageActions {
  async componentDidMount(): Promise<void> {
    this.syncAutoSource();
    await this.loadRouting();
    this.scope = new SettingsPageScope(await PlatformSettingLocks.load(), ['permalink_structure', 'routing_home_target']);
  }

  componentDidUpdate(): void {
    this.scheduleHomeOptions();
    this.syncAutoSource();
  }

  componentWillUnmount(): void {
    if (this.optionsTimeout) clearTimeout(this.optionsTimeout);
    this.optionsTimeout = null;
    this.optionsRequestId += 1;
    this.autoRequestId += 1;
  }

  render() {
    if (this.isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <Loader label={AdminI18n.t('settings.routing.loadingRoutingSettings')} />
        </div>
      );
    }

    const theme = this.theme;
    const structure = this.structure;
    const homeTarget = this.homeTarget;
    const resolvedSourceLabel = this.resolvedSourceLabel;

    if (structure === null || homeTarget === null) {
      return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
          <CompactPageHeader
            theme={theme}
            title={AdminI18n.t('settings.routing.routing')}
            subtitle={AdminI18n.t('settings.routing.homepageTargetPermalinkConfiguration')}
          />
          <LoadErrorPanel
            title={AdminI18n.t('settings.routing.routingSettingsCouldNotBe')}
            message={this.loadError || AdminI18n.t('settings.routing.theRoutingSettingsRequestFailed')}
            onRetry={this.retryLoad}
            isRetrying={this.isLoading}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          title={AdminI18n.t('settings.routing.routing')}
          subtitle={AdminI18n.t('settings.routing.homepageTargetPermalinkConfiguration')}
        />

        {this.outOfScope && (
          <SiteScopePanel detail={AdminI18n.t('settings.routing.thePermalinkStructureAndThe')} />
        )}

        {!this.outOfScope && (
        <div className="py-6 w-full fc-page-stack">
          <Card title={AdminI18n.t('settings.routing.homepageTarget')}>
            <SettingRow
              title={AdminI18n.t('settings.routing.rootRoute')}
              description={AdminI18n.t('settings.routing.targetsAreDiscoveredFromAvailable')}
            >
              <Select
                value={homeTarget}
                onChange={this.setHomeTarget}
                options={this.homeOptions}
                placeholder={AdminI18n.t('settings.routing.selectHomepageTarget')}
                theme={theme}
                searchable
                onSearchChange={this.setSearchTerm}
              />
            </SettingRow>
            <SettingRow title={AdminI18n.t('settings.routing.resolvedHomepageSource')} width={SettingRowWidth.AUTO}>
              <span className="fc-size-sm font-medium">{resolvedSourceLabel}</span>
            </SettingRow>
          </Card>

          <Card title={AdminI18n.t('settings.routing.permalinkStructure')}>
            <div className="fc-field-stack">
              <span className="fc-field-label">{AdminI18n.t('settings.routing.commonStructures')}</span>
              {/* One of a few, all in view, each with what it produces: the console's boxed choice. */}
              <RadioGroup boxed twoColumns label={AdminI18n.t('settings.routing.commonStructures')} value={structure} onChange={(value: string) => this.setStructure(value)}
                options={RoutingPageState.PRESETS.map((preset) => ({ value: preset.value, label: preset.label, description: <code className="fc-code">{preset.value}</code> }))} />
            </div>
            <div className="mt-6">
              <Input label={AdminI18n.t('settings.routing.customStructure')} value={structure} onChange={(e) => this.setStructure(e.target.value)} placeholder="/:year/:slug" />
            </div>
          </Card>

          <Card noPadding title={AdminI18n.t('settings.routing.availablePlaceholders')} className="fc-card--rows">
            <ListCard>
              {RoutingPageState.PLACEHOLDERS.map((tag) => (
                <ListRow
                  key={tag.label}
                  title={<code className="fc-code">{tag.label}</code>}
                  description={tag.description}
                  meta={`${AdminI18n.t('settings.routing.example')} ${tag.example}`}
                  actions={(
                    <Button variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} aria-label={tag.label} onClick={() => this.appendPlaceholder(tag.label)}>
                      <FrameworkIcons.Plus size={15} />
                    </Button>
                  )}
                />
              ))}
            </ListCard>
          </Card>
          <SettingsSaveBar dirty={this.isDirty} saving={this.isSaving} onSave={this.handleSave} onDiscard={this.discardChanges} />
        </div>
        )}
      </div>
    );
  }
}
