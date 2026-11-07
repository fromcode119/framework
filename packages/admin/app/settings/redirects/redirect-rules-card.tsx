import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Switch } from '@/components/ui/view/switch.client';
import { Input } from '@/components/ui/view/input.client';
import { Button } from '@/components/ui/view/button.client';
import { DataTablePagination } from '@/components/ui/view/data-table-pagination.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The rule list of Settings → Redirects. Presentational: every mutation is a callback into the page.
 * Rows are dense on purpose — a redirect table is scanned, not read. The store holds thousands of rules
 * (an import writes one per retired URL), so the card searches and pages over ALL of them and states the
 * total; a rule's target is edited in place, its From path is the rule's identity and stays fixed.
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

  @state editingId = 0;
  @state draft = '';

  private get isDark(): boolean {
    return this.theme === ThemeMode.DARK;
  }

  @bound handleToggle(redirect: Record<string, any>): void {
    this.onToggle(redirect);
  }

  @bound handleDelete(redirect: Record<string, any>): void {
    this.onDelete(redirect);
  }

  @bound startEdit(redirect: Record<string, any>): void {
    this.editingId = Number(redirect.id) || 0;
    this.draft = String(redirect.toPath ?? '');
  }

  @bound cancelEdit(): void {
    this.editingId = 0;
    this.draft = '';
  }

  @bound async saveEdit(redirect: Record<string, any>): Promise<void> {
    const toPath = this.draft.trim();
    if (!toPath || toPath === redirect.toPath) {
      this.cancelEdit();
      return;
    }
    if (await this.onRetarget(redirect, toPath)) this.cancelEdit();
  }

  private renderTarget(redirect: Record<string, any>): ReactNode {
    const isDark = this.isDark;
    if (redirect.type === '410') {
      return <code className={`truncate flex-1 font-mono text-[12px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{AdminI18n.t('settings.redirects.goneNoTarget')}</code>;
    }
    if (this.editingId === redirect.id) {
      return (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Input
            className="flex-1"
            inputClassName="font-mono text-[12px]"
            value={this.draft}
            autoFocus
            onChange={(event: any) => { this.draft = String(event?.target?.value ?? ''); }}
            onKeyDown={(event: any) => {
              if (event.key === 'Enter') void this.saveEdit(redirect);
              if (event.key === 'Escape') this.cancelEdit();
            }}
          />
          <Button onClick={() => this.saveEdit(redirect)} isLoading={this.busyId === redirect.id} className="h-8 px-3 rounded-lg font-semibold text-xs text-white">
            {AdminI18n.t('settings.redirects.save')}
          </Button>
          <button type="button" onClick={this.cancelEdit} className={`text-xs font-semibold px-2 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
            {AdminI18n.t('settings.redirects.cancel')}
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        title={AdminI18n.t('settings.redirects.editTarget', { fromPath: redirect.fromPath })}
        onClick={() => this.startEdit(redirect)}
        className={`truncate flex-1 text-start font-mono text-[12px] rounded px-1 -mx-1 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'}`}
      >
        {redirect.toPath}
      </button>
    );
  }

  private renderRow(redirect: Record<string, any>): ReactNode {
    const isDark = this.isDark;
    const enabled = Boolean(redirect.enabled);
    const busy = this.busyId === redirect.id;
    return (
      <div
        key={redirect.id}
        className={`py-2.5 flex items-center gap-3 border-b last:border-0 text-[13px] ${isDark ? 'border-slate-800' : 'border-slate-100'} ${enabled ? '' : 'opacity-50'}`}
      >
        <Switch checked={enabled} disabled={busy} onChange={() => this.handleToggle(redirect)} />
        <code className={`truncate max-w-[38%] font-mono text-[12px] ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={redirect.fromPath}>{redirect.fromPath}</code>
        <FrameworkIcons.ArrowRight size={13} className={isDark ? 'text-slate-600' : 'text-slate-300'} />
        {this.renderTarget(redirect)}
        <Badge variant={redirect.type === '302' || redirect.type === '410' ? BadgeVariant.WARNING : BadgeVariant.DEFAULT}>{redirect.type}</Badge>
        <span className={`w-14 text-end tabular-nums text-[12px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title={AdminI18n.t('settings.redirects.timesMatched')}>
          {Number(redirect.hitCount || 0)}×
        </span>
        <button
          type="button"
          aria-label={AdminI18n.t('settings.redirects.editTarget', { fromPath: redirect.fromPath })}
          disabled={busy || redirect.type === '410'}
          onClick={() => this.startEdit(redirect)}
          className={`p-1.5 rounded-md transition-colors disabled:opacity-30 ${isDark ? 'text-slate-500 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
        >
          <FrameworkIcons.Edit size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label={AdminI18n.t('settings.redirects.deleteRedirectFrom', { fromPath: redirect.fromPath })}
          disabled={busy}
          onClick={() => this.handleDelete(redirect)}
          className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-slate-500 hover:text-rose-400 hover:bg-slate-800' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
        >
          <FrameworkIcons.Trash size={14} strokeWidth={2} />
        </button>
      </div>
    );
  }

  render(): ReactNode {
    const { redirects, search } = this;
    const muted = this.isDark ? 'text-slate-500' : 'text-slate-400';
    return (
      <Card title={AdminI18n.t('settings.redirects.rulesCount', { total: this.total })} icon={<FrameworkIcons.CornerRightUp size={16} />}>
        <div className="pb-3">
          <Input
            placeholder={AdminI18n.t('settings.redirects.searchRules')}
            value={search}
            onChange={(event: any) => this.onSearch(String(event?.target?.value ?? ''))}
          />
        </div>
        {redirects.length === 0 ? (
          <p className={`text-[13px] py-4 ${muted}`}>
            {search
              ? AdminI18n.t('settings.redirects.noRulesMatch', { search })
              : AdminI18n.t('settings.redirects.noRedirectRulesYetA')}
          </p>
        ) : (
          redirects.map((redirect) => this.renderRow(redirect))
        )}
        <div className="-mx-4 -mb-4 mt-2 overflow-hidden rounded-b-[inherit]">
          <DataTablePagination totalDocs={this.total} limit={this.limit} page={this.page} onPageChange={this.onPageChange} />
        </div>
      </Card>
    );
  }
}
