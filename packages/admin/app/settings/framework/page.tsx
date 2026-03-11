"use client";

import React from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@/lib/icons';
import { AdminConstants } from '@/lib/constants';

const resources = [
  {
    title: 'Documentation',
    description: 'Platform docs, setup, architecture and deployment guides.',
    href: AdminConstants.FRAMEWORK_RESOURCES.DOCUMENTATION,
    external: true,
    icon: FrameworkIcons.Globe,
  },
  {
    title: 'Developer Guide',
    description: 'Developer workflows, plugin patterns and implementation standards.',
    href: AdminConstants.FRAMEWORK_RESOURCES.DEVELOPER_GUIDE,
    external: true,
    icon: FrameworkIcons.Terminal,
  },
  {
    title: 'OpenAPI Spec',
    description: 'Live API contract exposed by the running framework instance.',
    href: AdminConstants.FRAMEWORK_RESOURCES.OPENAPI,
    external: false,
    icon: FrameworkIcons.Link,
  },
  {
    title: 'Framework Roadmap',
    description: 'Track upcoming framework capabilities and milestones.',
    href: AdminConstants.FRAMEWORK_RESOURCES.FRAMEWORK_ROADMAP,
    external: true,
    icon: FrameworkIcons.Activity,
  },
  {
    title: 'Support',
    description: 'Support channels and troubleshooting documentation.',
    href: AdminConstants.FRAMEWORK_RESOURCES.SUPPORT,
    external: true,
    icon: FrameworkIcons.Help,
  },
];

const communities = [
  { label: 'Github', href: AdminConstants.FRAMEWORK_RESOURCES.GITHUB },
  { label: 'Discord', href: AdminConstants.FRAMEWORK_RESOURCES.DISCORD },
  { label: 'Twitter', href: AdminConstants.FRAMEWORK_RESOURCES.TWITTER },
];

export default function FrameworkSettingsPage() {
  const { theme } = ThemeHooks.useTheme();

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className={`sticky top-0 z-30 border-b backdrop-blur-md px-8 py-6 ${
        theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white/50 border-slate-100'
      }`}>
        <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Framework Resources
        </h1>
        <p className="text-[10px] font-bold text-slate-500 tracking-tight uppercase opacity-60">
          Admin-level docs, API and developer references
        </p>
      </div>

      <div className="p-8 lg:p-12 max-w-5xl space-y-8">
        <Card title="Core Resources">
          <div className="space-y-4">
            {resources.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border ${
                    theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50/60 border-slate-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold tracking-tight ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                        {item.title}
                      </h3>
                      <p className="text-[11px] font-bold text-slate-500 tracking-tight opacity-80 mt-1">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    as="a"
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    variant="secondary"
                    className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight"
                  >
                    Open
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Community">
          <div className="flex flex-wrap gap-3">
            {communities.map((item) => (
              <Button
                key={item.label}
                as="a"
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight"
              >
                {item.label}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
