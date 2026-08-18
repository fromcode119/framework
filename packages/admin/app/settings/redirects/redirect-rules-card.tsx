import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Switch } from '@/components/ui/view/switch.client';

/**
 * The rule list of Settings → Redirects. Presentational: every mutation is a callback into the page.
 * Rows are dense on purpose — a redirect table is scanned, not read.
 */
export class RedirectRulesCard extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare redirects: Record<string, any>[];
  @prop declare busyId: number;
  @prop declare onToggle: (redirect: Record<string, any>) => void;
  @prop declare onDelete: (redirect: Record<string, any>) => void;

  private get isDark(): boolean {
    return this.theme === ThemeMode.DARK;
  }

  @bound handleToggle(redirect: Record<string, any>): void {
    this.onToggle(redirect);
  }

  @bound handleDelete(redirect: Record<string, any>): void {
    this.onDelete(redirect);
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
        <code className={`truncate flex-1 font-mono text-[12px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`} title={redirect.toPath}>{redirect.toPath}</code>
        <Badge variant={redirect.type === '302' ? BadgeVariant.WARNING : BadgeVariant.DEFAULT}>{redirect.type}</Badge>
        <span className={`w-14 text-right tabular-nums text-[12px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title="Times matched">
          {Number(redirect.hitCount || 0)}×
        </span>
        <button
          type="button"
          aria-label={`Delete redirect from ${redirect.fromPath}`}
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
    const { redirects } = this;
    return (
      <Card title="Rules" icon={<FrameworkIcons.CornerRightUp size={16} />}>
        {redirects.length === 0 ? (
          <p className={`text-[13px] py-4 ${this.isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            No redirect rules yet. A rule catches a retired URL — one that no longer resolves to any
            content — and sends visitors to its replacement.
          </p>
        ) : (
          redirects.map((redirect) => this.renderRow(redirect))
        )}
      </Card>
    );
  }
}
