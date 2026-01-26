"use client";

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'blue' | 'gray' | 'purple' | 'green' | 'amber';
  className?: string;
}

export const Badge = ({ children, variant = 'default', className = '' }: BadgeProps) => {
  const variants = {
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    info: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    blue: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    gray: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    default: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
