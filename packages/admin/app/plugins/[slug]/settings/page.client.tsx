import type { ReactElement } from 'react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminComponent } from '@/components/view/admin-component.client';
import { prop } from '@fromcode119/react-class-components';

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
        <span className="fc-loader__ring fc-loader__ring--page" aria-hidden="true" />
      </div>
    );
  }
}
