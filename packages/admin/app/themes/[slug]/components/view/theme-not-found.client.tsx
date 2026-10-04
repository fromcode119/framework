import type { ReactNode } from 'react';
import Link from 'next/link';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Button } from '@/components/ui/view/button.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The theme page for a slug this site cannot see — a bookmark, a link from another site, a theme the
 * platform installed but no one assigned here. It used to render nothing at all. The same face as the
 * plugin page's PluginNotFound, so the two extension pages fail the same way.
 */
export class ThemeNotFound extends PureReactor {
  @prop declare themeSlug: string;

  @prop declare themesHref: string;

  render(): ReactNode {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="p-8 rounded-xl mb-8 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-200 dark:shadow-black/50">
          <FrameworkIcons.Palette size={64} className="text-rose-500" strokeWidth={1} />
        </div>
        <h1 className="text-4xl font-bold tracking-tighter text-slate-900 dark:text-white mb-4">{AdminI18n.t('themes.notAvailableHere', { slug: this.themeSlug })}</h1>
        <p className="text-slate-500 font-semibold text-center max-w-sm leading-relaxed mb-8 px-6">{AdminI18n.t('themes.notAvailableHereHelp')}</p>
        <div className="flex items-center gap-4">
          <Link href={this.themesHref}>
            <Button variant={ButtonVariant.PRIMARY} className="rounded-xl px-10 py-5 font-bold tracking-tight text-[13px]" icon={<FrameworkIcons.Palette size={18} />}>
              {AdminI18n.t('themes.manageThemes')}
            </Button>
          </Link>
          <Button variant={ButtonVariant.GHOST} onClick={() => window.history.back()} className="rounded-xl px-8 font-bold tracking-tight text-[13px]" icon={<FrameworkIcons.Left size={16} />}>
            {AdminI18n.t('plugins.list.goBack')}
          </Button>
        </div>
      </div>
    );
  }
}
