import { ListCard } from '@/components/ui/view/list-card.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
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
  private static get resources() {
    return [
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
  }
  private static get communities() {
    return [
  { label: AdminI18n.t('settings.framework.github'), href: AdminConstants.FRAMEWORK_RESOURCES.GITHUB },
];
  }
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

        <div className="py-6 w-full fc-page-stack">
          <Card noPadding title={AdminI18n.t('settings.framework.coreResources')} className="fc-card--rows">
            <ListCard>
              {FrameworkSettingsPage.resources.map((item) => {
                const Icon = item.icon;
                return (
                  <ListRow
                    key={item.title}
                    icon={<Icon size={16} />}
                    title={<span>{item.title}</span>}
                    description={item.description}
                    actions={(
                      <Button as="a" href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noopener noreferrer' : undefined} variant={ButtonVariant.SECONDARY}>
                        {AdminI18n.t('settings.framework.open')}
                      </Button>
                    )}
                  />
                );
              })}
            </ListCard>
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
                  variant={ButtonVariant.SECONDARY}
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
