"use client";

import React from 'react';
import Link from 'next/link';
import { Slot } from '@fromcode/react';
import { FrameworkIcons } from '@/lib/icons';
import { Button } from '@/components/ui/button';

interface CollectionListHeaderProps {
  collection: any;
  pluginSlug: string;
  slug: string;
  theme: string;
}

export const CollectionListHeader: React.FC<CollectionListHeaderProps> = ({
  collection,
  pluginSlug,
  slug,
  theme
}) => {
  return (
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
            <h1 className={`text-3xl font-semibold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {collection.slug === 'users' ? 'User Management' : (collection.name || slug.charAt(0).toUpperCase() + slug.slice(1))}
            </h1>
          </div>
          <p className="text-slate-500 font-semibold text-sm tracking-tight opacity-70">
            {collection.slug === 'users' 
              ? 'Manage system users, roles and security permissions.' 
              : `Manage and organize ${(collection.name || slug).toLowerCase()} records.`}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Slot name={`admin.collection.${slug}.header.actions`} props={{ collection }} />
          <Slot name="admin.collection.list.header.actions" props={{ collection }} />
          {collection.slug === 'users' && (
            <Button 
              variant="secondary"
              size="sm"
              className="h-11 rounded-xl font-semibold tracking-wide text-xs"
              icon={<FrameworkIcons.More size={18} />}
            >
              Invite
            </Button>
          )}
          <Button 
            variant="primary" 
            size="sm"
            as={Link}
            href={`/${pluginSlug}/${slug}/new`}
            className="px-6 py-3 rounded-xl font-semibold tracking-wide text-xs shadow-xl shadow-indigo-600/30"
            icon={<FrameworkIcons.Plus size={18} />}
          >
            {collection.slug === 'users' ? 'Create User' : 'New Entry'}
          </Button>
        </div>
      </div>
    </div>
  );
};
