import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type React from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { ActivityMode } from '@/app/activity/enums/activity-mode.enum';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { CodeBlock } from '@/components/ui/view/code-block.client';
import { Hint } from '@/components/ui/view/hint.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IAdminFact } from '@/components/ui/interfaces/admin-fact.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One activity entry, read in the console's side drawer — the way a file's details open in Media.
 *
 * System-log rows carry `level` and `message`; audit rows carry `status`, `action`, `resource` and a
 * `metadata` object instead. Neither has an actor column: an audit row names who acted inside its
 * metadata (`email`, `userId`), so that is where the actor is read from, and a row naming nobody
 * shows no actor rather than claiming "System".
 */
export class ActivityDetailModal extends PureReactor {
  @prop declare selectedLog: any;
  @prop declare mode: ActivityMode;
  @prop declare onClose: () => void;
  @prop declare onExport: (log: any) => void;

  @bound
  handleExport(): void {
    this.onExport(this.selectedLog);
  }

  /** The metadata object, whether the API sent it parsed or as JSON text; null when unreadable. */
  private get details(): Record<string, any> | null {
    const raw = this.selectedLog.context || this.selectedLog.metadata;
    if (!raw) return null;
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return { value: raw };
    }
  }

  private get pluginName(): string {
    const slug = String(this.selectedLog.pluginSlug || '');
    return slug && slug !== 'system' ? slug.charAt(0).toUpperCase() + slug.slice(1) : AdminI18n.t('activity.system');
  }

  private get actor(): string {
    const details = this.details;
    return String(details?.email || details?.userId || '');
  }

  private get badge(): React.ReactNode {
    const log = this.selectedLog;
    if (log.level) {
      const level = String(log.level);
      const tone = level === 'ERROR' ? 'danger' : level === 'WARN' ? 'warning' : 'default';
      return <StateBadge tone={tone}>{AdminI18n.t(`activity.level.${level}`)}</StateBadge>;
    }
    const status = String(log.status || '');
    if (!status) return null;
    const tone = status === 'violation' ? 'danger' : status === 'denied' ? 'warning' : 'success';
    return <StateBadge tone={tone}>{status}</StateBadge>;
  }

  private get facts(): IAdminFact[] {
    const log = this.selectedLog;
    const facts: IAdminFact[] = [
      { key: 'plugin', label: AdminI18n.t('activity.plugin'), value: this.pluginName },
      { key: 'time', label: AdminI18n.t('activity.time'), value: new Date(log.timestamp || log.createdAt).toLocaleString() },
    ];
    if (this.actor) facts.push({ key: 'actor', label: AdminI18n.t('activity.actor'), value: this.actor });
    if (this.mode === ActivityMode.SYSTEM) {
      facts.push({ key: 'message', label: AdminI18n.t('activity.event'), value: String(log.message || ''), wide: true });
    } else {
      facts.push({ key: 'action', label: AdminI18n.t('activity.action'), value: String(log.action || '') });
      facts.push({ key: 'resource', label: AdminI18n.t('activity.resource'), value: String(log.resource || ''), wide: true });
    }
    return facts.filter((fact) => fact.value);
  }

  render(): React.ReactNode {
    const details = this.details;
    return (
      <EditSheet
        isOpen
        title={AdminI18n.t('activity.eventDetails')}
        subtitle={<span className="fc-activity-detail__sub">{AdminI18n.t('activity.entryNumber', { id: this.selectedLog.id })}{this.badge}</span>}
        onClose={this.onClose}
        foot={
          <Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Download size={14} />} onClick={this.handleExport}>
            {AdminI18n.t('activity.exportJson')}
          </Button>
        }
      >
        <div className="fc-activity-detail">
          <AdminFactGrid facts={this.facts} />
          {details ? <CodeBlock label={AdminI18n.t('activity.recordedData')} code={JSON.stringify(details, null, 2)} /> : null}
          <Hint>{AdminI18n.t('activity.thisEntryIsPartOf')}</Hint>
        </div>
      </EditSheet>
    );
  }
}
