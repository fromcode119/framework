import { unstable_noStore as noStore } from 'next/cache';
import { HomeClient } from '@/app/components/view/home-client.client';
import { PageDocPrefetchView } from '@/components/page-doc-prefetch';
import { ThemeSsrHeadView } from '@/components/theme-ssr-head';
import { HomePageResolver } from '@/app/home-page-resolver';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { FrontendLocaleService } from '@/lib/frontend-locale-service';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';
import { ThemeServerRenderer } from '@/lib/ssr/theme-server-renderer';
import type { IHomePageProps } from '@/app/interfaces/home-page-props.interface';

export class HomePageRoute {
  static async generateMetadata({ searchParams }: IHomePageProps) {

    const { content, resolution } = await HomePageResolver.resolve(searchParams);
    return ResolvedContentMetadata.buildEnriched((content as Record<string, unknown> | null) || null, resolution?.type, '/');
  }

  static async render({ searchParams }: IHomePageProps) {

    noStore();
    const { content, forcedLayout } = await HomePageResolver.resolve(searchParams);
    const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
    const locale = await FrontendLocaleService.resolveDocumentLocale(routingConfig.strategy);
    // `w-full` with no reserved height matches HomeClient's own content wrapper; the theme's layout
    // is what reserves the viewport (`min-height: calc(100vh + 64px)`), so the box does not collapse.
    const ssrMarkup = await ThemeServerRenderer.render({
      content,
      locale,
      contentClassName: 'w-full',
      contentStyle: null,
    });
    return (
      <>
        {/* Emotion styles + LCP image preload, hoisted into <head> by React. */}
        {ssrMarkup ? <ThemeSsrHeadView.render markup={ssrMarkup} /> : null}
        {/* Page-scoped data prefetch (theme.json `fromPage` entries) — body script, pre-theme-boot. */}
        <PageDocPrefetchView.render content={content} />
        <HomeClient initialContent={content} forcedLayout={forcedLayout} ssrHtml={ssrMarkup?.bodyHtml || ''} ssrRendersContentSlot={Boolean(ssrMarkup?.rendersContentSlot)} />
      </>
    );
  }
}
