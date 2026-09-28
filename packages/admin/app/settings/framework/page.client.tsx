import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class FrameworkSettingsPage extends AdminComponent {
  /**
   * Every entry must point at a destination that resolves. The Documentation, Developer Guide and
   * Support cards linked to `docs.fromcode.com`, which does not exist (connection failure), so they
   * were removed rather than left as dead ends. The OpenAPI spec is served by this running instance,
   * and the GitHub org page is live.
   */
  private static readonly resources = [
  {
    title: AdminI18n.t('settings.framework.openapiSpec'),
    description: AdminI18n.t('settings.framework.liveApiContractExposedBy'),
    href: AdminConstants.FRAMEWORK_RESOURCES.OPENAPI,
    external: false,
    icon: FrameworkIcons.Link,
  },
  {
    title: AdminI18n.t('settings.framework.sourceIssues'),
    description: AdminI18n.t('settings.framework.frameworkSourceReleasesAndIssue'),
    href: AdminConstants.FRAMEWORK_RESOURCES.GITHUB,
    external: true,
    icon: FrameworkIcons.Activity,
  },
];
  private static readonly communities = [
  { label: AdminI18n.t('settings.framework.github'), href: AdminConstants.FRAMEWORK_RESOURCES.GITHUB },
];
  render() {
    const theme = this.theme;

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Globe size={18} strokeWidth={2} />}
          title={AdminI18n.t('settings.framework.frameworkResources')}
          subtitle={AdminI18n.t('settings.framework.adminLevelDocsApiAnd')}
        />

        <div className="p-6 w-full space-y-8">
          <Card title={AdminI18n.t('settings.framework.coreResources')}>
            <div className="space-y-4">
              {FrameworkSettingsPage.resources.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border ${
                      theme === ThemeMode.DARK ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/60 border-slate-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl ${theme === ThemeMode.DARK ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <h3 className={`text-sm font-semibold tracking-tight ${theme === ThemeMode.DARK ? 'text-slate-100' : 'text-slate-900'}`}>
                          {item.title}
                        </h3>
                        <p className="text-[13px] text-slate-500 leading-relaxed mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <Button
                      as="a"
                      href={item.href}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? AdminI18n.t('settings.framework.noopenerNoreferrer') : undefined}
                      variant={ButtonVariant.SECONDARY}
                      className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight"
                    >
                      {AdminI18n.t('settings.framework.open')}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title={AdminI18n.t('settings.framework.community')}>
            <div className="flex flex-wrap gap-3">
              {FrameworkSettingsPage.communities.map((item) => (
                <Button
                  key={item.label}
                  as="a"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant={ButtonVariant.OUTLINE}
                  className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight"
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }
}
