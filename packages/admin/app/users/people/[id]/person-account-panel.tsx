"use client";

import React from 'react';
import Link from 'next/link';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@fromcode119/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PersonAccountPanelProps } from './person-account-panel.interfaces';

/** The linked login-account facet of a person: login status, effective roles, and a link out to the
 * full user record. Surfaces the `partner`/`admin` etc. roles so the person's platform-wide identity
 * is visible in one place, without coupling the framework to any specific plugin. */
export class PersonAccountPanel extends React.Component<PersonAccountPanelProps> {
  private roleVariant(role: string): any {
    if (role === 'admin') return 'purple';
    if (role === 'partner') return 'green';
    return 'blue';
  }

  render(): React.ReactNode {
    const { person, theme, granting, onGrantLogin } = this.props;
    const account = person.account;
    const card = `rounded-3xl border p-6 ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800/50' : 'bg-white border-white shadow-xl'}`;
    const heading = `text-[11px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} mb-4`;

    if (!account) {
      return (
        <div className={card}>
          <h3 className={heading}>Login account</h3>
          <p className="text-[13px] font-bold text-slate-400 mb-4">No login account is linked to this person.</p>
          <Button variant="secondary" isLoading={granting} disabled={!person.email}
            icon={<FrameworkIcons.Plus size={14} />} onClick={onGrantLogin}
            className="h-9 px-4 rounded-xl font-bold tracking-tight text-[11px]">
            Create login account
          </Button>
          {!person.email ? <p className="text-[11px] text-slate-400 mt-2">An email is required to create an account.</p> : null}
        </div>
      );
    }

    return (
      <div className={card}>
        <h3 className={heading}>Login account</h3>
        <div className="flex items-center gap-2 text-[13px] font-bold text-emerald-500 mb-3">
          <FrameworkIcons.UserCheck size={16} /> Linked · user #{account.id}
        </div>
        <div className="space-y-1.5 mb-4">
          <div className="text-[12px] font-bold text-slate-500">{account.email}</div>
          {account.username ? <div className="text-[11px] text-slate-400">@{account.username}</div> : null}
        </div>
        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Roles</div>
          <div className="flex flex-wrap gap-1.5">
            {account.roles.length
              ? account.roles.map((r) => <Badge key={r} variant={this.roleVariant(r)} className="font-bold tracking-tight">{r}</Badge>)
              : <span className="text-[11px] text-slate-400">No roles</span>}
          </div>
        </div>
        <Link href={AdminConstants.ROUTES.USERS.DETAIL(account.id)}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-indigo-600 hover:text-indigo-700">
          Open user record <FrameworkIcons.Right size={14} />
        </Link>
      </div>
    );
  }
}
