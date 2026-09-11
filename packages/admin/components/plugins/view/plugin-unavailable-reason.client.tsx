import type { ReactNode } from 'react';
import { state, prop } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';

/**
 * Why a screen is missing, when the extension behind it exists but is not running.
 *
 * The admin's metadata carries only ACTIVE extensions, so one that was stopped — held for a
 * capability change, errored by a security violation — simply vanishes from it, and the page said
 * "not registered or currently inactive in your cluster". For a bundled extension that is the
 * framework's own screen, so the sentence is not merely vague, it is wrong: nothing was
 * uninstalled, something refused to run, and the difference is the whole of what to do next.
 *
 * The health report knows the state. Rendering nothing while it loads is deliberate — a guess that
 * resolves into a correction reads worse than a beat of silence.
 */
export class PluginUnavailableReason extends AdminComponent {
  @prop declare pluginSlug: string;

  @state private reason = '';

  private mounted = false;

  async componentDidMount(): Promise<void> {
    this.mounted = true;
    const report = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.HEALTH).catch(() => null);
    if (!this.mounted || !report) return;

    const entry = (report.entries || []).find(
      (row: any) => String(row?.slug || '').toLowerCase() === String(this.pluginSlug || '').toLowerCase(),
    );
    if (!entry) return;

    this.reason = PluginUnavailableReason.describe(String(entry.state || ''), entry);
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  /** The state in the words an operator can act on, never the enum value on its own. */
  private static describe(state: string, entry: Record<string, any>): string {
    if (state === 'error') {
      return 'It is installed, but stopped after an error. The Plugin Health screen has the details.';
    }
    if (state === 'held') {
      const added = (entry.addedCapabilities || []).join(', ');
      return added
        ? `It is held for review because it now asks for: ${added}. Approve it on the Plugin Health screen.`
        : 'It is held for review. The Plugin Health screen has the details.';
    }
    if (state === 'inactive') {
      return 'It is installed but disabled.';
    }
    return '';
  }

  render(): ReactNode {
    if (!this.reason) return null;

    return (
      <p className="mb-8 max-w-md px-6 text-center text-[13px] font-medium leading-relaxed text-slate-600 dark:text-slate-300">
        {this.reason}
      </p>
    );
  }
}
