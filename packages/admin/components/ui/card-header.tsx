'use client';

import React from 'react';

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  badge?: React.ReactNode;
}

export function CardHeader({ title, subtitle, description, badge }: CardHeaderProps) {
  const desc = description || subtitle;

  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
        {desc ? <p className="mt-1 text-xs text-slate-500">{desc}</p> : null}
      </div>
      {badge}
    </div>
  );
}
