"use client";

import React, { useState, useEffect } from 'react';
import { Slot } from '@fromcode/react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { FrameworkIcons } from '@/lib/icons';

interface User {
  id: string | number;
  email: string;
  roles?: string[] | string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
  status?: string;
}

import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';

export default function UsersPage() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, roles: 0 });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/users`);
        const userData = response.docs || [];
        setUsers(userData);
        
        // Mock stats based on real data
        setStats({
          total: userData.length,
          active: userData.length, // Logic for active status can be added later
          roles: new Set(userData.flatMap((u: any) => {
            const roles = typeof u.roles === 'string' ? JSON.parse(u.roles) : (u.roles || []);
            return roles;
          })).size || 1
        });
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

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
    if (typeof user.roles === 'string') {
      try {
        return JSON.parse(user.roles);
      } catch {
        return [user.roles];
      }
    }
    return user.roles || ['user'];
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
            <div className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{getDisplayName(user)}</div>
            <div className="text-xs text-slate-500 flex items-center gap-1">
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
            <Badge key={role} variant={role === 'admin' ? 'purple' : 'blue'}>
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
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-bold text-emerald-500 text-[11px] uppercase tracking-widest">Active</span>
        </div>
      )
    },
    {
      header: 'Joined',
      id: 'createdAt',
      accessor: (user: User) => (
        <div className="flex items-center gap-2 font-medium text-slate-500">
          <FrameworkIcons.Calendar size={14} className="opacity-50" />
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Initial'}
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col h-full -mx-8 -mt-8 overflow-hidden bg-slate-50/20 dark:bg-transparent">
      {/* Header section with white high-contrast style */}
      <div className={`p-8 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'} bg-white dark:bg-transparent shadow-sm dark:shadow-none`}>
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-slate-800' : 'bg-indigo-50'} text-indigo-500`}>
                  <FrameworkIcons.Users size={20} />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tight">Identity Management</h1>
              </div>
              <p className="text-slate-500 font-medium text-sm">Manage users, adjust permissions and review access logs.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Slot name="admin.users.list.header.actions" />
              <Button 
                variant="primary" 
                icon={<FrameworkIcons.Plus size={18} />}
              >
                Invite User
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-[1200px] mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              title="Identity Base" 
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
                placeholder="Search identity base by name or email..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full rounded-2xl py-3 pl-12 pr-4 outline-none border transition-all text-sm font-medium ${
                  theme === 'dark' 
                    ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' 
                    : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                }`} 
              />
            </div>
          </div>

          <div className={`rounded-3xl border overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none ${
            theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <DataTable
              columns={columns}
              data={filteredUsers}
              loading={loading}
              totalDocs={filteredUsers.length}
              limit={10}
              page={1}
              emptyMessage="No identity records match your query"
              actions={(user) => (
                <div className="flex items-center justify-end gap-2">
                  <Slot name="admin.users.list.table.actions" props={{ user }} />
                  <button className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}>
                    <FrameworkIcons.More size={18} />
                  </button>
                </div>
              )}
            />
          </div>
          
          <Slot name="admin.users.list.bottom" />
        </div>
      </div>
    </div>
  );
}
