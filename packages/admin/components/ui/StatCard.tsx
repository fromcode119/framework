"use client";

import React from 'react';
import { useTheme } from '@/components/ThemeContext';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export const StatCard = ({ title, value, icon, trend }: StatCardProps) => {
  const { theme } = useTheme();
  
  return (
    <div className={`p-6 rounded-2xl border transition-all hover:shadow-md ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}%
          </div>
        )}
      </div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
      <h3 className={`text-2xl font-black mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
    </div>
  );
};
