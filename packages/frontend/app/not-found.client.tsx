import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Bridge } from '@fromcode119/react-class-components';
import { Override } from '@fromcode119/react/view/override.client';
import { ContextHooks } from '@fromcode119/react';
import type { INotFoundValues } from '@/app/interfaces/not-found-values.interface';
import { NotFoundFallback } from '@/app/components/view/not-found-fallback.client';

/** Hook→class bridge: reads the current path and lets a theme override the 404 surface. */
export class NotFound extends Bridge<INotFoundValues> {
  protected read(): INotFoundValues {
    return { path: usePathname(), locale: ContextHooks.useTranslation().locale };
  }

  protected present({ path, locale }: INotFoundValues): ReactNode {
    return (
      <Override
        name="framework.page.404"
        props={{ path }}
        fallback={<Override name="frontend.page.404" props={{ path }} fallback={<NotFoundFallback locale={locale} />} />}
      />
    );
  }
}
