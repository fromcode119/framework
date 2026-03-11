"use client";

import React, { useState, useEffect } from 'react';
import { Slot } from '@fromcode119/react';
import { ThemeHooks } from '@/components/use-theme';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';

interface User {
  id: string | number;
  email: string;
  roles?: string[] | string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
  accountStatus?: string;
  forcePasswordReset?: boolean;
}

import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { Loader } from '@/components/ui/loader';
import { Dropdown } from '@/components/ui/dropdown';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AdminPageFooter } from '@/components/ui/admin-page-footer';
import { useRouter } from 'next/navigation';

export default function UsersPage() {
  const { theme } = ThemeHooks.useTheme();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, roles: 0 });
  
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = async () => {
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USERS);
      const userData = response.docs || [];
      setUsers(userData);
      
      // Stats based on real RBAC data
      const activeUsers = userData.filter((user: any) => String(user.accountStatus || 'active').toLowerCase() !== 'suspended').length;
      setStats({
        total: userData.length,
        active: activeUsers,
        roles: new Set(userData.flatMap((u: any) => u.roles || [])).size || 1
      });
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await AdminApi.delete(AdminConstants.ENDPOINTS.SYSTEM.USER(deleteConfirm.id));
      await fetchUsers();
      setDeleteConfirm(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader label="Decrypting User Database..." />
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    (u.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     u.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     (u.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()))
  );

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
    return user.email[0].toUpperCase();
  };

  const getDisplayName = (user: User) => {
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    return user.email.split('@')[0];
  };

  const getRoles = (user: User): string[] => {
    return Array.isArray(user.roles) ? user.roles : [];
  };

  const columns = [
    {
      header: 'User',
      id: 'user',
      accessor: (user: User) => (
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 overflow-hidden flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/20">
            {getInitials(user)}
          </div>
          <div>
            <div className={`font-bold tracking-tight ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{getDisplayName(user)}</div>
            <div className="text-[11px] font-bold tracking-tight text-slate-500 flex items-center gap-1 opacity-70">
              <FrameworkIcons.Mail size={12} /> {user.email}
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'Roles',
      id: 'roles',
      accessor: (user: User) => (
        <div className="flex flex-wrap gap-1">
          {getRoles(user).map(role => (
            <Badge key={role} variant={role === 'admin' ? 'purple' : 'blue'} className="font-bold tracking-tight">
              {role}
            </Badge>
          ))}
        </div>
      )
    },
    {
      header: 'Status',
      id: 'status',
      accessor: (user: User) => (
        <div className="flex items-center gap-2">
          {String(user.accountStatus || 'active').toLowerCase() === 'suspended' ? (
            <>
              <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
              <span className="font-bold text-rose-500 text-[11px] tracking-tight">Suspended</span>
            </>
          ) : (
            <>
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              <span className="font-bold text-emerald-500 text-[11px] tracking-tight">Active</span>
            </>
          )}
          {user.forcePasswordReset ? (
            <span className="font-bold text-amber-500 text-[10px] tracking-tight uppercase">Reset Required</span>
          ) : null}
        </div>
      )
    },
    {
      header: 'Joined',
      id: 'createdAt',
      accessor: (user: User) => (
        <div className="flex items-center gap-2 font-bold text-[11px] tracking-tight text-slate-500">
          <FrameworkIcons.Calendar size={14} className="opacity-50" />
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Initial'}
        </div>
      )
    }
  ];

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 transition-transform hover:rotate-0 ${
                theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-600 text-white'
              }`}>
                <FrameworkIcons.Users size={20} strokeWidth={2} />
              </div>
              <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Users
              </h1>
            </div>
            <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
              Manage your users and their assigned roles.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Slot name="admin.users.list.header.actions" />
            <Link href={AdminConstants.ROUTES.USERS.NEW}>
              <Button 
                variant="secondary"
                className="h-11 px-6 rounded-xl font-bold tracking-tight text-xs border-slate-200 dark:border-slate-800" 
                icon={<FrameworkIcons.Plus size={16} />}
              >
                Create User
              </Button>
            </Link>
            <Link href={AdminConstants.ROUTES.USERS.ROLE_LIST}>
              <Button 
                className="h-11 px-6 rounded-xl font-bold tracking-tight text-xs shadow-lg shadow-indigo-600/10 text-white" 
                icon={<FrameworkIcons.Shield size={16} strokeWidth={2} />}
              >
                Manage Roles
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-6 lg:px-12 py-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="User Base" 
            value={stats.total.toLocaleString()} 
            icon={<FrameworkIcons.Users size={20} />} 
            trend={{ value: 4, isPositive: true }}
          />
          <StatCard 
            title="Active Now" 
            value={stats.active.toLocaleString()} 
            icon={<FrameworkIcons.UserCheck size={20} />} 
          />
          <StatCard 
            title="Access Levels" 
            value={stats.roles.toLocaleString()} 
            icon={<FrameworkIcons.Shield size={20} />} 
          />
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <FrameworkIcons.Search size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Search user base by name or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-11 rounded-xl pl-12 pr-4 outline-none border transition-all text-[13px] font-bold tracking-tight ${
                theme === 'dark' 
                  ? 'bg-slate-900/50 border-slate-800 text-white focus:border-indigo-500/50 focus:bg-slate-900 shadow-2xl shadow-black/40' 
                  : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-xl shadow-slate-200/50'
              }`} 
            />
          </div>
        </div>

        <div className={`rounded-3xl border overflow-hidden shadow-2xl shadow-slate-200/40 dark:shadow-none transition-all duration-300 ${
          theme === 'dark' ? 'bg-slate-900/40 border-slate-800/50 backdrop-blur-sm' : 'bg-white border-white shadow-xl'
        }`}>
          <DataTable
            columns={columns}
            data={filteredUsers}
            loading={false}
            totalDocs={filteredUsers.length}
            limit={10}
            page={1}
            emptyMessage="No user records match your query"
            actions={(user) => (
              <div className="flex items-center justify-end gap-2">
                <Slot name="admin.users.list.table.actions" props={{ user }} />
                <Dropdown
                  trigger={
                    <button className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}>
                      <FrameworkIcons.MoreVertical size={16} strokeWidth={2.5} />
                    </button>
                  }
                  items={[
                    { 
                      label: 'View Profile', 
                      icon: <FrameworkIcons.Users size={16} />,
                      onClick: () => router.push(AdminConstants.ROUTES.USERS.DETAIL(user.id))
                    },
                    { 
                      label: 'Edit Account', 
                      icon: <FrameworkIcons.Settings size={16} />,
                      onClick: () => router.push(AdminConstants.ROUTES.USERS.EDIT(user.id))
                    },
                    { 
                      label: 'Manage Roles', 
                      icon: <FrameworkIcons.Shield size={16} />,
                      onClick: () => router.push(AdminConstants.ROUTES.USERS.ROLES(user.id))
                    },
                    { 
                      label: 'Security & 2FA', 
                      icon: <FrameworkIcons.ShieldCheck size={16} />,
                      onClick: () => router.push(AdminConstants.ROUTES.USERS.SECURITY(user.id))
                    },
                    { 
                      label: 'Login History', 
                      icon: <FrameworkIcons.Activity size={16} />,
                      onClick: () => router.push(AdminConstants.ROUTES.USERS.AUTH_ACTIVITY(user.id))
                    },
                    { 
                      label: 'Remove User', 
                      icon: <FrameworkIcons.Warning size={16} />,
                      variant: 'danger',
                      onClick: () => setDeleteConfirm(user)
                    }
                  ]}
                />
              </div>
            )}
          />
        </div>
        
        <Slot name="admin.users.list.bottom" />
      </div>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Revoke Access?"
        description={`This will permanently delete ${deleteConfirm?.email}'s account and revoke all system access. This action cannot be undone.`}
        confirmLabel="Deactivate User"
      />

      <AdminPageFooter
        label="User Management Infrastructure"
        description="Manage user accounts and security roles."
        links={[
          { label: 'Roles', href: AdminConstants.ROUTES.USERS.ROLE_LIST },
          { label: 'Permissions', href: AdminConstants.ROUTES.USERS.PERMISSIONS },
          { label: 'Activity Log', href: AdminConstants.ROUTES.ACTIVITY },
        ]}
      />
    </div>
  );
}
