import type { KeyboardEvent, ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Icon } from '@/components/view/icon.client';
import { NavUtils } from '@/lib/nav-utils';
import type { ISecondaryPanelItem } from '@fromcode119/react';

export class SecondarySidebarPanelBody extends PureReactor {
  @prop declare items: ISecondaryPanelItem[];
  @prop declare pathname: string;
  @prop declare onListKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  @prop declare onItemActivate?: (item?: ISecondaryPanelItem) => void;
  @prop declare onMouseEnter?: () => void;
  @prop declare onMouseLeave?: () => void;

  private getGrouped(): Array<[string, ISecondaryPanelItem[]]> {
    const groups: Record<string, ISecondaryPanelItem[]> = {};
    for (const item of this.items) {
      const key = String(item.group || 'General').trim() || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }

  render(): ReactNode {
    const grouped = this.getGrouped();
    // Candidate paths for longest-prefix-wins active matching, so an index item (e.g. /users) is NOT
    // also marked active when a deeper sibling (/users/roles) is the real match.
    const allPaths = grouped.flatMap(([, items]) => items.map((i) => i.path)).filter(Boolean) as string[];

    return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Secondary navigation" onKeyDown={this.onListKeyDown} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
      <div className="space-y-4">
        {grouped.map(([group, groupItems]) => (
          <section key={group} className="space-y-1">
            <h3 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group}</h3>
            {groupItems.map((item) => {
              const isActive = NavUtils.isPathActive(this.pathname, item.path, allPaths);
              return (
                <Link
                  key={item.canonicalId}
                  href={item.path}
                  data-secondary-link="true"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => this.onItemActivate?.(item)}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2 transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'}`}
                >
                  <span className={`${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'} pt-0.5`}>
                    <Icon name={item.icon || 'Circle'} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold leading-tight">{item.label}</span>
                    {item.description && (
                      <span className={`mt-0.5 block text-[10px] ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>{item.description}</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </section>
        ))}
      </div>
    </nav>
    );
  }
}
