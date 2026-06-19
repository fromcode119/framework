'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@fromcode119/react';
import type { NewUserRolesCardProps } from './new-user-roles-card.interfaces';

export class NewUserRolesCard extends React.Component<NewUserRolesCardProps> {
  render(): React.ReactNode {
    const { theme, roles, loadingRoles, selectedRoles, rolesError, onToggleRole } = this.props;
    return (
      <Card title="Roles & Permissions">
         <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-slate-500 font-medium">
                Permissions are inherited from roles. Assign roles now so the user has the correct access immediately.
              </p>
              <span className="text-[10px] font-bold uppercase tracking-tight text-indigo-500">
                {selectedRoles.length} selected
              </span>
            </div>

            {loadingRoles ? (
              <div className="text-sm text-slate-500 font-medium py-6">Loading roles...</div>
            ) : roles.length === 0 ? (
              <div className="text-sm text-slate-500 font-medium py-6">
                No roles available. Create roles first in Users &gt; Roles.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {roles.map((role) => {
                  const selected = selectedRoles.includes(role.slug);
                  return (
                    <button
                      key={role.slug}
                      type="button"
                      onClick={() => onToggleRole(role.slug)}
                      className={`text-left rounded-2xl border p-4 transition-all ${
                        selected
                          ? theme === 'dark'
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-indigo-500 bg-indigo-50'
                          : theme === 'dark'
                            ? 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            {role.name || role.slug}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {role.description || 'No description'}
                          </p>
                        </div>
                        <div className={`mt-0.5 ${selected ? 'text-indigo-500' : 'text-slate-300'}`}>
                          <FrameworkIcons.Check size={16} />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>{role.slug}</span>
                        <span>{Array.isArray(role.permissions) ? role.permissions.length : 0} permissions</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {rolesError && (
              <div className="text-sm text-rose-500 font-semibold">{rolesError}</div>
            )}
         </div>
      </Card>
    );
  }
}
