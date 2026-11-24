import type { ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { IEdgeRecord } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { Alert } from '@/components/ui/view/alert.client';
import { Button } from '@/components/ui/view/button.client';
import { CodeBlock } from '@/components/ui/view/code-block.client';
import { Dialog } from '@/components/ui/view/dialog.client';
import { PromptDialog } from '@/components/ui/view/prompt-dialog.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Security → Dashboard → Edges: the edges added to the platform — whether each has joined, where it last
 * connected from, its version, until when its certificate is valid — and "Add edge", "New token" and
 * "Remove". A token is shown once, inside the command to run on the edge; it is never stored or shown
 * again. Without a control address and port nothing can join, and this says so with the way to set them.
 */
export class SecurityEdges extends AdminComponent {
  declare props: Pick<SecurityEdges, 'onOpenSettings'>;
  @prop declare onOpenSettings: () => void;

  @state data: { edges: IEdgeRecord[]; control: { address: string; port: number } | null; controlProblem: string; authority: { rootNotAfter: string } | null } | null = null;
  @state loadError: string | null = null;
  @state adding = false;
  @state removing: IEdgeRecord | null = null;
  @state command: { name: string; command: string; expiresAt: string } | null = null;
  @state acting = false;

  async componentDidMount(): Promise<void> {
    await this.load();
  }

  @bound
  async load(): Promise<void> {
    this.loadError = null;
    try {
      this.data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.EDGES);
    } catch (err: any) {
      this.loadError = err?.message || AdminI18n.t('settings.security.edgesLoadFailed');
    }
  }

  @bound openAdd(): void { this.adding = true; }
  @bound closeAdd(): void { this.adding = false; }
  @bound closeRemove(): void { this.removing = null; }
  @bound closeCommand(): void { this.command = null; }

  @bound
  async add(name: string): Promise<void> {
    if (!name.trim()) return;
    await this.act(async () => {
      const added = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.EDGES, { name: name.trim() });
      this.adding = false;
      this.command = { name: added.edge.name, command: added.command, expiresAt: added.expiresAt };
    });
  }

  private async newToken(edge: IEdgeRecord): Promise<void> {
    await this.act(async () => {
      const issued = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.EDGE_TOKEN(edge.id), {});
      this.command = { name: edge.name, command: issued.command, expiresAt: issued.expiresAt };
    });
  }

  @bound
  async remove(): Promise<void> {
    const edge = this.removing;
    if (!edge) return;
    await this.act(async () => {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.EDGE_REVOKE(edge.id), {});
      this.removing = null;
      this.runtime.notify.addNotification({ title: AdminI18n.t('settings.security.edgeRemovedTitle'), message: AdminI18n.t('settings.security.edgeRemovedMessage', { name: edge.name }), type: NotificationType.SUCCESS });
    });
  }

  private async act(action: () => Promise<void>): Promise<void> {
    this.acting = true;
    try {
      await action();
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: AdminI18n.t('settings.security.edgeActionFailed'), message: err?.message || '', type: NotificationType.ERROR });
    } finally {
      this.acting = false;
      await this.load();
    }
  }

  private static time(iso: string): string {
    return iso ? new Date(iso).toLocaleString(AdminI18n.locale, { dateStyle: 'short', timeStyle: 'short' }) : '';
  }

  private badge(edge: IEdgeRecord): ReactNode {
    if (edge.revokedAt) return <StateBadge>{AdminI18n.t('settings.security.edgeRemoved')}</StateBadge>;
    if (!edge.enrolledAt) return <StateBadge tone="warning">{AdminI18n.t('settings.security.edgeWaiting')}</StateBadge>;
    if (Date.parse(edge.certificateNotAfter) <= Date.now()) return <StateBadge tone="danger">{AdminI18n.t('settings.security.edgeCertificateExpired')}</StateBadge>;
    return <StateBadge tone="success">{AdminI18n.t('settings.security.edgeJoined')}</StateBadge>;
  }

  private row(edge: IEdgeRecord): ReactNode {
    const t = (key: string, values: Record<string, unknown>) => AdminI18n.t(`settings.security.${key}`, values);
    const parts = [
      edge.lastSeenAt ? t('edgeLastSeen', { at: SecurityEdges.time(edge.lastSeenAt) }) : '',
      edge.lastAddress ? t('edgeFrom', { address: edge.lastAddress }) : '',
      edge.version,
      edge.certificateNotAfter && !edge.revokedAt ? t('edgeCertificateUntil', { at: SecurityEdges.time(edge.certificateNotAfter) }) : '',
      edge.revokedAt ? t('edgeRemovedAt', { at: SecurityEdges.time(edge.revokedAt), by: edge.revokedBy }) : t('edgeAddedAt', { at: SecurityEdges.time(edge.createdAt), by: edge.createdBy }),
    ].filter(Boolean);
    return (
      <ListRow
        key={edge.id}
        icon={<FrameworkIcons.Server size={16} />}
        title={edge.name}
        badges={this.badge(edge)}
        description={parts.join(' · ')}
        descriptionTitle={[...parts, edge.id].join('\n')}
        menu={edge.revokedAt ? undefined : [
          { label: AdminI18n.t('settings.security.edgeNewToken'), onClick: () => { void this.newToken(edge); } },
          { label: AdminI18n.t('settings.security.edgeRemove'), variant: DropdownItemVariant.DANGER, onClick: () => { this.removing = edge; } },
        ]}
      />
    );
  }

  private controlNotice(): ReactNode {
    const problem = this.data?.controlProblem;
    if (!problem) return null;
    return (
      <Alert tone={problem === 'invalid' ? 'danger' : 'info'} action={<Button variant={ButtonVariant.SECONDARY} onClick={this.onOpenSettings}>{AdminI18n.t('settings.security.edgeOpenSettings')}</Button>}>
        {AdminI18n.t(problem === 'invalid' ? 'settings.security.edgeControlInvalid' : 'settings.security.edgeControlMissing')}
      </Alert>
    );
  }

  private dialogs(): ReactNode {
    const command = this.command;
    return (
      <>
        <PromptDialog isOpen={this.adding} onClose={this.closeAdd} onConfirm={this.add} isLoading={this.acting}
          title={AdminI18n.t('settings.security.edgeAddTitle')} description={AdminI18n.t('settings.security.edgeAddText')}
          placeholder={AdminI18n.t('settings.security.edgeNamePlaceholder')} confirmLabel={AdminI18n.t('settings.security.edgeAdd')} />
        <Dialog isOpen={command !== null} onClose={this.closeCommand} wide
          title={AdminI18n.t('settings.security.edgeCommandTitle', { name: command?.name ?? '' })}
          description={AdminI18n.t('settings.security.edgeCommandText', { at: SecurityEdges.time(command?.expiresAt ?? '') })}
          foot={<Button variant={ButtonVariant.PRIMARY} onClick={this.closeCommand}>{AdminI18n.t('settings.security.edgeDone')}</Button>}>
          {command ? <CodeBlock code={command.command} label={AdminI18n.t('settings.security.edgeCommandLabel')} /> : null}
        </Dialog>
        <ConfirmDialog isOpen={this.removing !== null} onClose={this.closeRemove} onConfirm={this.remove} isLoading={this.acting} variant={ButtonVariant.DANGER}
          title={AdminI18n.t('settings.security.edgeRemoveConfirmTitle', { name: this.removing?.name ?? '' })}
          description={AdminI18n.t('settings.security.edgeRemoveConfirmText')} confirmLabel={AdminI18n.t('settings.security.edgeRemove')} />
      </>
    );
  }

  render(): ReactNode {
    const title = AdminI18n.t('settings.security.edges');
    if (this.loadError) return <LoadErrorPanel title={title} message={this.loadError} onRetry={this.load} isRetrying={false} />;
    const data = this.data;
    if (!data) return null;
    const add = <Button variant={ButtonVariant.SECONDARY} onClick={this.openAdd} disabled={!data.control}>{AdminI18n.t('settings.security.edgeAdd')}</Button>;
    if (!data.edges.length) {
      return (
        <>
          <RecordCard title={title} aside={add}>
            {this.controlNotice()}
            <EmptyState inline icon={<FrameworkIcons.Server size={16} />} title={AdminI18n.t('settings.security.noEdges')} />
          </RecordCard>
          {this.dialogs()}
        </>
      );
    }
    const joined = data.edges.filter((edge) => edge.enrolledAt && !edge.revokedAt).length;
    const subtitle = [
      AdminI18n.t('settings.security.edgesJoined', { joined }),
      data.control ? AdminI18n.t('settings.security.edgesControl', { control: `${data.control.address}:${data.control.port}` }) : '',
      data.authority ? AdminI18n.t('settings.security.edgesRootUntil', { at: SecurityEdges.time(data.authority.rootNotAfter) }) : '',
    ].filter(Boolean).join(' · ');
    return (
      <>
        {this.controlNotice()}
        <ListShell title={title} count={data.edges.length} subtitle={subtitle} actions={add}>
          <div>{data.edges.map((edge) => this.row(edge))}</div>
        </ListShell>
        {this.dialogs()}
      </>
    );
  }
}
