"use client";

import React from 'react';

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
  return (
    <div className="p-6 rounded-lg border transition-all hover:shadow-md bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400">
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}%
          </div>
        )}
      </div>
      <p className="text-[11px] font-semibold text-slate-500 tracking-wide">{title}</p>
      <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{value}</h3>
    </div>
  );
};
