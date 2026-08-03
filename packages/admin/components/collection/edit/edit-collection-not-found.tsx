import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import Link from 'next/link';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';

export class EditCollectionNotFound extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare slug: string;
  @prop declare pluginSlug: string;

  render(): ReactNode {
    const { theme, slug, pluginSlug } = this;
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in-95 duration-700">
        <div className={`p-8 rounded-xl mb-8 relative group ${theme === ThemeMode.DARK ? 'bg-slate-900 shadow-2xl shadow-black/50' : 'bg-white shadow-2xl shadow-slate-200'}`}>
          <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
          <FrameworkIcons.Search size={64} className="text-indigo-500 relative z-10" strokeWidth={1} />
        </div>

        <h2 className={`text-4xl font-bold tracking-tighter uppercase mb-4 ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
          Collection Not Found
        </h2>

        <p className="text-slate-500 font-bold text-center max-w-sm leading-relaxed mb-10 px-6">
          The collection <span className="text-indigo-500">"{slug}"</span> doesn't seem to be part of the <span className="text-indigo-500 uppercase tracking-wide text-[10px] ml-1">{pluginSlug}</span> plugin marketplace.
        </p>

        <div className="flex items-center gap-4">
          <Button
            variant={ButtonVariant.GHOST}
            onClick={() => window.history.back()}
            className="rounded-xl px-8 font-bold uppercase tracking-wide text-[10px] text-slate-400"
          >
            Go Back
          </Button>
          <Button
            variant={ButtonVariant.PRIMARY}
            as={Link}
            href="/"
            className="rounded-xl px-10 py-5 font-bold uppercase tracking-wide text-[10px] shadow-2xl shadow-indigo-500/30"
            icon={<FrameworkIcons.Layout size={18} />}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }
}
