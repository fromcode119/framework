"use client";

import React from 'react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FrameworkIcons } from '@/lib/icons';

const MOCK_CONTENT = [
  { id: 1, title: 'Welcome to Vselenski Portal', author: 'Kristian', status: 'Published', date: '2024-03-22' },
  { id: 2, title: 'New Course Announcement', author: 'Maria', status: 'Draft', date: '2024-03-21' },
  { id: 3, title: 'Privacy Policy Update', author: 'System', status: 'Published', date: '2024-03-15' },
];

export default function ContentPage() {
  const { theme } = useTheme();

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-xl shadow-inner ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-indigo-50 border border-indigo-100'} text-indigo-500`}>
                <FrameworkIcons.Layout size={20} />
              </div>
              <h1 className={`text-2xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Content Management</h1>
            </div>
            <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
              Create and edit your site pages, posts and documents.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2.5 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-[13px] text-white rounded-2xl font-black shadow-xl shadow-indigo-600/30 transition-all active:scale-95 group">
              <FrameworkIcons.Plus size={18} className="transition-transform group-hover:rotate-90" />
              <span className="uppercase tracking-widest">New Entry</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-6 lg:px-12 py-12 space-y-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <FrameworkIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search content..." 
              className={`w-full rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold outline-none border transition-all ${
                theme === 'dark' 
                  ? 'bg-slate-900/50 border-slate-800 text-white focus:border-indigo-500/50 focus:bg-slate-900 shadow-2xl shadow-black/40' 
                  : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-xl shadow-slate-200/50'
              }`} 
            />
          </div>
        </div>

        <Card className="p-0 overflow-hidden border-none shadow-2xl shadow-slate-200/40 dark:shadow-none bg-white dark:bg-slate-900/40 rounded-3xl backdrop-blur-sm border border-white/5 dark:border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`${theme === 'dark' ? 'bg-slate-950/40' : 'bg-slate-50/50'} border-b ${theme === 'dark' ? 'border-slate-800/50' : 'border-slate-100'}`}>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Title</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Author</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Last Modified</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {MOCK_CONTENT.map((entry) => (
                  <tr key={entry.id} className={`group ${theme === 'dark' ? 'hover:bg-indigo-500/5' : 'hover:bg-slate-50/80'} transition-all duration-300`}>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl transition-colors ${
                          theme === 'dark' 
                            ? 'bg-slate-800 text-slate-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-400' 
                            : 'bg-white text-slate-400 border border-slate-200 group-hover:border-indigo-200 group-hover:text-indigo-500'
                        }`}>
                          <FrameworkIcons.Text size={18} />
                        </div>
                        <span className={`text-sm font-black tracking-tight ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{entry.title}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-bold text-slate-500">{entry.author}</span>
                    </td>
                    <td className="px-8 py-6">
                      <Badge variant={entry.status === 'Published' ? 'green' : 'amber'}>{entry.status}</Badge>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-tighter">
                        <FrameworkIcons.Clock size={14} className="opacity-50" />
                        {entry.date}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                         <button className={`p-2.5 rounded-xl transition-all ${
                           theme === 'dark' ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'
                         }`}>
                           <FrameworkIcons.Edit size={18} />
                         </button>
                         <button className={`p-2.5 rounded-xl transition-all ${
                           theme === 'dark' ? 'hover:bg-slate-800 text-slate-500 hover:text-slate-300' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                         }`}>
                           <FrameworkIcons.Eye size={18} />
                         </button>
                         <button className={`p-2.5 rounded-xl transition-all ${
                           theme === 'dark' ? 'hover:bg-slate-800 text-slate-500 hover:text-slate-300' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                         }`}>
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
      </div>

      <div className={`mt-auto border-t py-12 backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/40 border-slate-800' 
          : 'bg-slate-50/50 border-slate-100'
      }`}>
        <div className="w-full px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                Content Infrastructure Node // CORE
              </span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight opacity-70">Centralized management of system-wide content assets and documents.</p>
          </div>
          
          <div className="flex items-center gap-10 text-[11px] font-black uppercase tracking-widest text-slate-400">
            <span className="hover:text-indigo-500 cursor-pointer transition-colors hover:translate-x-1 duration-300">Documentation</span>
            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span className="hover:text-indigo-500 cursor-pointer transition-colors hover:translate-x-1 duration-300">Schema Guide</span>
            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span className="hover:text-indigo-500 cursor-pointer transition-colors hover:translate-x-1 duration-300">Support</span>
          </div>
        </div>
      </div>
    </div>
  );
}
