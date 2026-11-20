import type { ReactElement } from 'react';
import { Slot } from '@fromcode119/react';
import { FrameworkIcons } from '@fromcode119/react';
import { prop, state } from '@fromcode119/react-class-components';
import { AdminPathUtils } from '@/lib/admin-path';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { PluginMountErrorFallback } from '@/components/view/plugin-mount-error-fallback';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';
import { StatePage } from '@/components/ui/view/state-page.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Alert } from '@/components/ui/view/alert.client';

export class DynamicPluginPage extends AdminComponent {
  @prop declare params: Promise<{ path: string[] }>;

  @state path: string[] = [];
  @state resolved = false;

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.params;
    if (!this.mounted) return;
    this.path = params.path;
    this.resolved = true;
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private get resolvedPath(): { pathname: string; segments: string[] } {
    return AdminPathUtils.resolveCatchAll(this.path);
  }

  private get menuItems(): any[] {
    return this.runtime.plugins.menuItems ?? [];
  }

  /** Find the most specific matching menu item. */
  private get activeItem(): any {
    const { pathname } = this.resolvedPath;
    const menuItems = this.menuItems;

    let activeItem = menuItems.find((item: any) => item.path === pathname);

    if (!activeItem) {
      for (const item of menuItems) {
        const child = item.children?.find((c: any) => c.path === pathname);
        if (child) {
          activeItem = { ...child, pluginSlug: child.pluginSlug || item.pluginSlug };
          break;
        }
      }
    }

    if (!activeItem) {
      activeItem = menuItems.find((item: any) => item.path && pathname.startsWith(item.path + '/'));
    }

    return activeItem;
  }

  render(): ReactElement | null {
    if (!this.resolved) return null;

    const { pathname, segments: effectivePath } = this.resolvedPath;
    const pluginSlug = this.activeItem?.pluginSlug || effectivePath[0];
    const pageSlot = `admin.plugin.${pluginSlug}.page.${effectivePath.join('.')}`;

    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="space-y-8">
          <Slot name={pageSlot} errorFallback={PluginMountErrorFallback.render} fallback={
             <div className="space-y-8">
               <Alert tone="info">
                 <AdminRichText k="shell.pluginPage.defaultView" vars={{ plugin: pluginSlug, slot: pageSlot }} classes={{ code: 'fc-mono' }} />
               </Alert>

               <Slot name={`admin.plugin.${pluginSlug}.content`} errorFallback={PluginMountErrorFallback.render} fallback={
                 <StatePage
                    icon={<FrameworkIcons.Info size={18} />}
                    title={AdminI18n.t('shell.pluginPage.workspace', { name: effectivePath[effectivePath.length - 1].replace(/-/g, ' ') })}
                    hint={<AdminRichText k="shell.pluginPage.noComponent" vars={{ path: pathname, plugin: pluginSlug }} classes={{ code: 'fc-mono' }} />}
                    actions={<Button variant={ButtonVariant.PRIMARY} as={AdminLink} href="/plugins">{AdminI18n.t('shell.pluginPage.backToMarketplace')}</Button>}
                 />
               }/>
             </div>
          }/>
        </div>
      </div>
    );
  }
}
