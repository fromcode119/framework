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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Content Management
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Create and edit your site pages, posts and documents.
          </p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all transform hover:scale-[1.02] shadow-lg shadow-indigo-600/20">
          <FrameworkIcons.Plus size={18} />
          <span>New Entry</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <FrameworkIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search content..." 
            className={`w-full rounded-xl py-3 pl-10 pr-4 outline-none border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`} 
          />
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'} border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-500">Title</th>
                <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-500">Author</th>
                <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-500">Last Modified</th>
                <th className="px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CONTENT.map((entry) => (
                <tr key={entry.id} className={`group border-b ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-900/50' : 'border-slate-100 hover:bg-slate-50/50'} transition-colors`}>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-400 border shadow-sm'}`}>
                        <FrameworkIcons.Text size={18} />
                      </div>
                      <span className={`font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{entry.title}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm text-slate-500 font-medium">{entry.author}</td>
                  <td className="px-8 py-5">
                    <Badge variant={entry.status === 'Published' ? 'green' : 'amber'}>{entry.status}</Badge>
                  </td>
                  <td className="px-8 py-5 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <FrameworkIcons.Clock size={14} />
                      {entry.date}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-end gap-2">
                       <button className={`p-2 rounded-lg hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-600 transition-colors`}>
                         <FrameworkIcons.Edit size={18} />
                       </button>
                       <button className={`p-2 rounded-lg hover:bg-slate-500/10 text-slate-400 hover:text-slate-600 transition-colors`}>
                         <FrameworkIcons.Eye size={18} />
                       </button>
                       <button className={`p-2 rounded-lg hover:bg-slate-500/10 text-slate-400 hover:text-slate-600 transition-colors`}>
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
  );
}
