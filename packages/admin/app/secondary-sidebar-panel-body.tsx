"use client";

import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { NavUtils } from '@/lib/nav-utils';
import type { SecondaryPanelContext, SecondaryPanelItem } from '@fromcode119/react';

type SecondarySidebarPanelBodyProps = {
  context: SecondaryPanelContext | null;
  items: SecondaryPanelItem[];
  sourceLabel: string;
  pathname: string;
  onListKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onItemActivate?: (item?: SecondaryPanelItem) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export default function SecondarySidebarPanelBody(props: SecondarySidebarPanelBodyProps) {
  const grouped = React.useMemo(() => {
    const groups: Record<string, SecondaryPanelItem[]> = {};
    for (const item of props.items) {
      const key = String(item.group || 'General').trim() || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [props.items]);

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-label="Secondary navigation" onKeyDown={props.onListKeyDown} onMouseEnter={props.onMouseEnter} onMouseLeave={props.onMouseLeave}>
      <div className="space-y-5">
        {grouped.map(([group, groupItems]) => (
          <section key={group} className="space-y-2">
            <h3 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group}</h3>
            {groupItems.map((item) => {
              const isActive = NavUtils.isPathMatch(props.pathname, item.path);
              return (
                <Link
                  key={item.canonicalId}
                  href={item.path}
                  data-secondary-link="true"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => props.onItemActivate?.(item)}
                  className={`flex items-start gap-3 rounded-lg px-3.5 py-2.5 transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'}`}
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
