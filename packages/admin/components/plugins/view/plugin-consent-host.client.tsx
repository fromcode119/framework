import type { ReactNode } from 'react';
import { prop, state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { PluginConsentDialog } from '@/components/plugins/view/plugin-consent-dialog.client';
import type { IPluginConsentSummary } from '@/components/plugins/interfaces/plugin-consent-summary.interface';
import { PluginConsentRequest } from '@/components/plugins/plugin-consent-request';
import { PluginConsentScope } from '@/components/plugins/enums/plugin-consent-scope.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Walks an operator through approving one or more plugins, one consent dialog at a time.
 *
 * A page sets `slugs` (and, when a refused enable already carried it, `initial` for the first one) and
 * hears back per approval and once at the end. A plugin that turns out to need no approval is skipped.
 */
export class PluginConsentHost extends AdminComponent {
  @prop declare slugs: string[];
  @prop declare scope?: PluginConsentScope;
  @prop declare initial?: IPluginConsentSummary | null;
  @prop declare onApproved: (slug: string) => void;
  /** Every plugin was answered, or the operator cancelled. */
  @prop declare onFinished: () => void;

  @state summary: IPluginConsentSummary | null = null;
  private index = 0;

  componentDidMount(): void {
    if (this.slugs.length) void this.load(0);
  }

  componentDidUpdate(previous: { slugs: string[] }): void {
    if (previous.slugs !== this.slugs && this.slugs.length) void this.load(0);
  }

  private get resolvedScope(): PluginConsentScope {
    return this.scope ?? PluginConsentScope.PLATFORM;
  }

  private async load(index: number): Promise<void> {
    this.index = index;
    const slug = this.slugs[index];
    if (!slug) {
      this.summary = null;
      this.onFinished();
      return;
    }
    try {
      const summary = index === 0 && this.initial?.slug === slug ? this.initial : await PluginConsentRequest.fetch(slug, this.resolvedScope);
      // Nothing to approve: it is left exactly as it is — never switched on behind the operator's back.
      if (summary.requiresApproval) {
        this.summary = summary;
        return;
      }
    } catch (error: unknown) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('plugins.consent.failed'), (error as { message?: string } | null)?.message || slug);
    }
    await this.load(index + 1);
  }

  @bound private approved(slug: string): void {
    this.runtime.notify.notify(NotificationType.SUCCESS, AdminI18n.t('plugins.consent.approved'), AdminI18n.t('plugins.consent.approvedText', { slug }));
    this.onApproved(slug);
    void this.load(this.index + 1);
  }

  @bound private cancelled(): void {
    this.summary = null;
    this.onFinished();
  }

  render(): ReactNode {
    return <PluginConsentDialog summary={this.summary} scope={this.resolvedScope} onClose={this.cancelled} onApproved={this.approved} />;
  }
}
