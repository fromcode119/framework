import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { SearchField } from '@/components/ui/view/search-field.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Switch } from '@/components/ui/view/switch.client';
import { Input } from '@/components/ui/view/input.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The rule list of Settings → Redirects. Presentational: every mutation is a callback into the page.
 * Rows are dense on purpose — a redirect table is scanned, not read. The store holds thousands of rules
 * (an import writes one per retired URL), so the card searches and pages over ALL of them and states the
 * total; a rule's target is changed in the sheet at the side, its From path is the rule's identity and stays fixed.
 */
export class RedirectRulesCard extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare redirects: Record<string, any>[];
  @prop declare busyId: number;
  @prop declare onToggle: (redirect: Record<string, any>) => void;
  @prop declare onDelete: (redirect: Record<string, any>) => void;
  @prop declare onRetarget: (redirect: Record<string, any>, toPath: string) => Promise<boolean>;
  @prop declare total: number;
  @prop declare page: number;
  @prop declare limit: number;
  @prop declare search: string;
  @prop declare onSearch: (search: string) => void;
  @prop declare onPageChange: (page: number) => void;

  /** The rule whose target is being changed, in the sheet at the side. */
  @state editing: Record<string, any> | null = null;
  @state draft = '';
  /** The rule about to be removed, while its removal is being confirmed. */
  @state removing: Record<string, any> | null = null;

  @bound startEdit(redirect: Record<string, any>): void {
    this.editing = redirect;
    this.draft = String(redirect.toPath ?? '');
  }

  @bound cancelEdit(): void {
    this.editing = null;
    this.draft = '';
  }

  @bound async saveEdit(): Promise<void> {
    const redirect = this.editing;
    if (!redirect) return;
    const toPath = this.draft.trim();
    if (!toPath || toPath === redirect.toPath) {
      this.cancelEdit();
      return;
    }
    if (await this.onRetarget(redirect, toPath)) this.cancelEdit();
  }

  private get columns(): any[] {
    return [
      { header: AdminI18n.t('common.enabled'), id: 'on', accessor: (redirect: any) => (
        <Switch checked={Boolean(redirect.enabled)} disabled={this.busyId === redirect.id} onChange={() => this.onToggle(redirect)} />
      ) },
      // One column takes the spare width: two that both ask for all of it leave the second with none.
      { header: AdminI18n.t('settings.redirects.fromPath'), id: 'from', className: 'fc-dt-clip', accessor: (redirect: any) => <code className="fc-dt-code" title={redirect.fromPath}>{redirect.fromPath}</code> },
      { header: AdminI18n.t('settings.redirects.toPathOrUrl'), id: 'to', className: 'fc-dt-fill', accessor: (redirect: any) => (
        redirect.type === '410'
          ? <span className="fc-dt-quiet">{AdminI18n.t('settings.redirects.goneNoTarget')}</span>
          : <code className="fc-dt-code" title={redirect.toPath}>{redirect.toPath}</code>
      ) },
      { header: AdminI18n.t('users.fields.type'), id: 'type', accessor: (redirect: any) => (
        <Badge variant={redirect.type === '302' || redirect.type === '410' ? BadgeVariant.WARNING : BadgeVariant.DEFAULT}>{redirect.type}</Badge>
      ) },
      { header: AdminI18n.t('settings.redirects.timesMatched'), id: 'hits', accessor: (redirect: any) => `${Number(redirect.hitCount || 0)}×` },
    ];
  }

  private actions(redirect: Record<string, any>): ReactNode {
    const items: any[] = [];
    if (redirect.type !== '410') items.push({ label: AdminI18n.t('settings.redirects.editTarget', { fromPath: redirect.fromPath }), icon: <FrameworkIcons.Edit size={15} />, onClick: () => this.startEdit(redirect) });
    items.push({ label: AdminI18n.t('settings.redirects.deleteRedirectFrom', { fromPath: redirect.fromPath }), icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: () => { this.removing = redirect; } });
    return <Dropdown align={HorizontalAlign.RIGHT} items={items} trigger={<span className="fc-record-card__menu" aria-label={AdminI18n.t('common.more')}><FrameworkIcons.More size={15} /></span>} />;
  }

  render(): ReactNode {
    const { redirects, search } = this;
    return (
      <ListShell title={AdminI18n.t('settings.redirects.rules')} count={this.total}
        tools={<SearchField value={search} onChange={this.onSearch} placeholder={AdminI18n.t('settings.redirects.searchRules')} />}>
        {redirects.length === 0 ? (
          <EmptyState icon={<FrameworkIcons.CornerRightUp size={18} />} title={search ? AdminI18n.t('settings.redirects.noRulesMatch', { search }) : AdminI18n.t('settings.redirects.noRedirectRulesYetA')} />
        ) : (
          <DataTable
            columns={this.columns}
            data={redirects as any}
            actions={(redirect: any) => this.actions(redirect)}
            rowClassName={(redirect: any) => (redirect.enabled ? '' : 'fc-dt-row--off')}
            totalDocs={this.total} limit={this.limit} page={this.page} onPageChange={this.onPageChange}
          />
        )}
        <EditSheet isOpen={Boolean(this.editing)} onClose={this.cancelEdit} onSave={() => void this.saveEdit()} saving={Boolean(this.editing) && this.busyId === this.editing?.id}
          title={AdminI18n.t('settings.redirects.editTarget', { fromPath: this.editing?.fromPath ?? '' })}>
          <div className="fc-form-stack">
            <Input label={AdminI18n.t('settings.redirects.fromPath')} value={this.editing?.fromPath ?? ''} readOnly />
            <Input label={AdminI18n.t('settings.redirects.toPathOrUrl')} value={this.draft} autoFocus placeholder={AdminI18n.t('settings.redirects.toPathExample')}
              onChange={(event: any) => { this.draft = String(event?.target?.value ?? ''); }}
              onKeyDown={(event: any) => { if (event.key === 'Enter') void this.saveEdit(); }} />
          </div>
        </EditSheet>
        {/* A rule is removed for good, so it is asked first, like every other removal in the console. */}
        <ConfirmDialog
          isOpen={Boolean(this.removing)}
          onClose={() => { this.removing = null; }}
          onConfirm={() => { const rule = this.removing; this.removing = null; if (rule) this.onDelete(rule); }}
          title={AdminI18n.t('settings.redirects.deleteRedirectFrom', { fromPath: this.removing?.fromPath ?? '' })}
          description={this.removing ? `${this.removing.fromPath} → ${this.removing.type === '410' ? AdminI18n.t('settings.redirects.goneNoTarget') : this.removing.toPath}` : ''}
          confirmLabel={AdminI18n.t('common.delete')}
          variant={ButtonVariant.DANGER}
        />
      </ListShell>
    );
  }
}
