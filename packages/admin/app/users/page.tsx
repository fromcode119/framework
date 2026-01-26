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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Identity Management
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Manage system users, roles and permissions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Slot name="admin.users.list.header.actions" />
          <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all transform hover:scale-[1.02] shadow-lg shadow-indigo-600/20">
            <FrameworkIcons.Plus size={18} />
            <span>Invite User</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Users', value: stats.total.toLocaleString(), icon: <FrameworkIcons.Users size={20} className="text-indigo-500" /> },
          { label: 'Recently Active', value: stats.active.toLocaleString(), icon: <FrameworkIcons.UserCheck size={20} className="text-green-500" /> },
          { label: 'Role Groups', value: stats.roles.toLocaleString(), icon: <FrameworkIcons.Shield size={20} className="text-amber-500" /> },
        ].map((stat) => (
          <Card key={stat.label} className="py-4 px-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
              <h3 className={`text-2xl font-black mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stat.value}</h3>
            </div>
            <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'}`}>
              {stat.icon}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <FrameworkIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full rounded-xl py-3 pl-10 pr-4 outline-none border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`} 
          />
        </div>
        <button className={`flex items-center gap-2 px-6 py-3 rounded-xl border font-semibold transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <FrameworkIcons.Filter size={18} />
          <span>Filters</span>
        </button>
      </div>

      <Card className="px-0 py-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className={`${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'} border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                <th className="px-8 py-5 font-bold text-slate-500">USER</th>
                <th className="px-8 py-5 font-bold text-slate-500">ROLES</th>
                <th className="px-8 py-5 font-bold text-slate-500">STATUS</th>
                <th className="px-8 py-5 font-bold text-slate-500">JOINED</th>
                <th className="px-8 py-5 font-bold text-slate-500 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <FrameworkIcons.Loader className="animate-spin inline-block mr-2 text-indigo-500" />
                    <span className="text-slate-500">Loading identity records...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <FrameworkIcons.User size={40} className="text-slate-300 mb-2" />
                       <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>No identity records found</h3>
                       <p className="text-sm text-slate-500 max-w-xs mx-auto">
                         The users table is currently empty. If you are logged in using a legacy session, you may need to re-initialize your account in the setup page.
                       </p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.map(user => (
                <tr key={user.id} className={`group border-b ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-900/50' : 'border-slate-100 hover:bg-indigo-50/30'} transition-colors`}>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 overflow-hidden flex items-center justify-center font-bold text-white shadow-sm`}>
                        {getInitials(user)}
                      </div>
                      <div>
                        <div className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{getDisplayName(user)}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <FrameworkIcons.Mail size={12} /> {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-wrap gap-1">
                      {getRoles(user).map(role => (
                        <Badge key={role} variant={role === 'admin' ? 'purple' : 'blue'}>
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full bg-green-500`} />
                      <span className={`font-medium text-green-500`}>Active</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className={`flex items-center gap-2 font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      <FrameworkIcons.Calendar size={14} className="opacity-50" />
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Initial'}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Slot name="admin.users.list.table.actions" props={{ user }} />
                      <button className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-white text-slate-400 hover:text-indigo-600 hover:shadow-sm'}`}>
                        <FrameworkIcons.More size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
      <Slot name="admin.users.list.bottom" />
    </div>
  );
}
