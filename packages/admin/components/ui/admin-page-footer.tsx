"use client";

import React from 'react';
import Link from 'next/link';

type FooterLink = {
  label: string;
  href: string;
};

export function AdminPageFooter({
  label,
  description,
  links,
  accent = 'indigo',
}: {
  label: string;
  description: string;
  links: FooterLink[];
  accent?: 'indigo' | 'emerald';
}) {
  const accentClasses =
    accent === 'emerald'
      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
      : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]';

  return (
    <div className="p-10 border-t mt-auto bg-slate-50/50 border-slate-100 dark:bg-slate-950/20 dark:border-slate-800">
      <div className="w-full px-6 lg:px-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${accentClasses}`} />
              <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400">
                {label}
              </span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{description}</p>
          </div>

          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-tight text-slate-400">
            {links.map((link, index) => (
              <React.Fragment key={link.href}>
                {index > 0 && <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-800" />}
                <Link href={link.href} className="hover:text-indigo-500 transition-colors">
                  {link.label}
                </Link>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
