import type { ReactElement } from 'react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop } from '@fromcode119/reactor';

export class PluginSettingsRedirectPage extends AdminComponent {
  @prop declare params: Promise<{ slug: string }>;

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const params = await this.params;
    if (!this.mounted) return;
    this.router.replace(AdminConstants.ROUTES.PLUGINS.SETTINGS_TAB(params.slug));
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  render(): ReactElement {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
}
