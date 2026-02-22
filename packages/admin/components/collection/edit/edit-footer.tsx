"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@/lib/icons';

interface EditFooterProps {
  collection: any;
  theme: string;
  isNew: boolean;
  discardHref?: string;
  handleSubmit: (e: any, summary: string) => void;
  changeSummary: string;
  setChangeSummary: (val: string) => void;
  saving: boolean;
}

export const EditFooter: React.FC<EditFooterProps> = ({
  collection,
  theme,
  isNew,
  discardHref,
  handleSubmit,
  changeSummary,
  setChangeSummary,
  saving
}) => {
  const router = useRouter();

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[100] border-t py-10 backdrop-blur-3xl transition-all duration-300 ${
      theme === 'dark' 
        ? 'bg-slate-950/80 border-slate-800/50 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]' 
        : 'bg-white/80 border-slate-100 shadow-lg'
    }`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8 pl-20 lg:pl-64">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)] animate-pulse" />
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              Persistence Layer // {collection.slug}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <Button 
            variant="ghost" 
            className="rounded-xl px-6 text-[10px] font-bold uppercase tracking-wide text-slate-400"
            onClick={() => {
              if (discardHref) {
                router.push(discardHref);
                return;
              }
              router.back();
            }}
          >
            Discard Changes
          </Button>
          <Button 
            className="rounded-xl px-12 shadow-2xl shadow-indigo-600/30 text-[10px] font-bold uppercase tracking-wide py-4.5"
            onClick={(e) => {
               handleSubmit(e, changeSummary);
               setChangeSummary('');
            }}
            isLoading={saving}
            icon={<FrameworkIcons.Save size={16} strokeWidth={3} />}
          >
            {isNew ? 'Create Entry' : 'Commit Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};
