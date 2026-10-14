/**
 * The page frame: the layout catalogue, the layout bound to each width, the app shell, the boot and the
 * theme's configuration. The page layout already renders the framework's own surfaces (the account,
 * sign-in and sign-up, email preferences) so a new theme does not have to learn that contract by trial.
 */
export class ThemeScaffoldLayoutFiles {
  /** Path (inside the theme) to file content, for a theme called `slug`. */
  static files(slug: string): Record<string, string> {
    return {
      'src/layouts/interfaces/theme-template-definition.interface.ts': `/** One entry of the theme's template catalogue; the admin's layout picker and the runtime both derive from it. */
export interface IThemeTemplateDefinition {
  key: string;
  label: string;
  description: string;
  /** How wide the content runs: \`contained\` (reading width) or \`wide\` (full-bleed sections). */
  width: string;
}
`,
      'src/layouts/layout-catalog.ts': `import type { IThemeTemplateDefinition } from '@theme/layouts/interfaces/theme-template-definition.interface';

/** The layouts a CMS page can choose. Mirrored in theme.json \`layouts\` so the admin picker and the runtime agree. */
export class ThemeLayoutCatalog {
  static readonly TEMPLATES: IThemeTemplateDefinition[] = [
    {
      key: 'page.default',
      label: 'Standard page',
      description: 'Content in a comfortable reading width.',
      width: 'contained',
    },
    {
      key: 'page.wide',
      label: 'Wide page',
      description: 'Full-width sections with no side margins, for landing and home pages.',
      width: 'wide',
    },
  ];

  static readonly DEFAULT_KEY = 'page.default';
}
`,
      'src/layouts/layout-shell.tsx': `import type { ReactNode } from 'react';
import { Bridge, ContextHooks, PageStyleProvider, Slot, prop } from '@fromcode119/sdk/react';
import { ThemeProvider } from '@theme/context/theme-context';
import { ThemeEditorSessionService } from '@theme/lib/site/theme-editor-session-service';

/**
 * What every layout is wrapped in: the page style provider, the theme runtime, and, for CMS editor
 * sessions only, the editor's app-shell slot (a plain visitor keeps a tree whose identity never changes).
 * A Bridge because the style variants are reachable only through a hook.
 */
export class LayoutShell extends Bridge<{ themeStyleVariants: unknown }> {
  @prop declare page: any;

  @prop declare children: ReactNode;

  protected read(): { themeStyleVariants: unknown } {
    return { themeStyleVariants: ContextHooks.usePlugins().themeStyleVariants };
  }

  private get body(): ReactNode {
    return ThemeEditorSessionService.isEditorSessionRequest()
      ? <Slot name="frontend.editor.app-shell" props={{ page: this.page, children: this.children }} fallback={this.children} />
      : this.children;
  }

  protected present({ themeStyleVariants }: { themeStyleVariants: unknown }): ReactNode {
    return (
      <PageStyleProvider page={this.page} themeStyleVariants={themeStyleVariants}>
        <ThemeProvider>{this.body}</ThemeProvider>
      </PageStyleProvider>
    );
  }
}
`,
      'src/layouts/page-layout.tsx': `import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/sdk/react';
import { AccountShell, AuthMode, AuthShell, TokenEmailPreferencesPanel } from '@fromcode119/sdk/react';
import { AccountRouteUtils } from '@fromcode119/sdk';
import { App } from '@theme/components/app';
import { LayoutShell } from '@theme/layouts/layout-shell';

/**
 * The one page structure: the site chrome around the page's content. For the pages the framework itself
 * renders (the account, sign-in and sign-up, email preferences) it puts that surface in the content
 * instead of the block flow; everything else is the CMS blocks the operator built.
 */
export class PageLayout extends Reactor {
  declare props: any;

  /** The global email-preferences page, reached from the unsubscribe link in any message. */
  private static readonly EMAIL_PREFERENCES_SLUG = 'unsubscribe';

  /** Slug to an \`AuthMode\` member, never a bare string: the shell compares members. */
  private static readonly AUTH_MODE_BY_SLUG: Record<string, AuthMode> = {
    login: AuthMode.LOGIN,
    register: AuthMode.REGISTER,
    'forgot-password': AuthMode.FORGOT,
    'reset-password': AuthMode.RESET,
  };

  private static isAccount(page: any): boolean {
    const slug = String(page?.slug || '').trim();
    const base = AccountRouteUtils.base();
    const path = String(page?.customPermalink || page?.url || (slug ? \`/\${slug}\` : '')).trim();
    return slug === 'account' || path === base || path.startsWith(\`\${base}/\`);
  }

  private content(page: any, children: ReactNode): ReactNode {
    const slug = String(page?.slug || '').trim();
    if (PageLayout.isAccount(page)) return <AccountShell page={page} />;
    if (slug === PageLayout.EMAIL_PREFERENCES_SLUG) return <div className="${slug}-unsubscribe"><TokenEmailPreferencesPanel /></div>;
    if (PageLayout.AUTH_MODE_BY_SLUG[slug]) return <AuthShell mode={PageLayout.AUTH_MODE_BY_SLUG[slug]} />;
    return children;
  }

  render(): ReactNode {
    const { children, page, width } = this.props;
    return (
      <LayoutShell page={page}>
        <App page={page} width={width}>{this.content(page, children)}</App>
      </LayoutShell>
    );
  }

  /** The framework asks whether a layout renders its own content, so it can skip the block flow for those pages. */
  static handlesOwnContent(page: any): boolean {
    const slug = String(page?.slug || '').trim();
    return PageLayout.isAccount(page)
      || slug === PageLayout.EMAIL_PREFERENCES_SLUG
      || Object.prototype.hasOwnProperty.call(PageLayout.AUTH_MODE_BY_SLUG, slug);
  }
}
`,
      'src/layouts/theme-layouts.tsx': `import { ThemeLayoutCatalog } from '@theme/layouts/layout-catalog';
import { PageLayout } from '@theme/layouts/page-layout';

/**
 * Builds the \`layouts\` map the framework registers: one entry per catalogue template, each the same
 * structure bound to its width. Built once: a rebuilt map would hand React new component types and
 * remount every page.
 */
export class ThemeLayouts {
  private static built: Record<string, any> | null = null;

  private static bind(width: string): any {
    const Bound = (props: Record<string, unknown>) => <PageLayout {...props} width={width} />;
    Bound.handlesOwnContent = PageLayout.handlesOwnContent;
    return Bound;
  }

  static build(): Record<string, any> {
    if (ThemeLayouts.built) return ThemeLayouts.built;
    const map: Record<string, any> = {};
    for (const template of ThemeLayoutCatalog.TEMPLATES) map[template.key] = ThemeLayouts.bind(template.width);
    ThemeLayouts.built = map;
    return map;
  }
}
`,
      'src/components/preview-page-ground.tsx': `import type { ReactNode } from 'react';
import { ThemeComponent } from '@theme/context/theme-component';

/**
 * The ground around a block previewed in the admin (\`cms.preview.surface\`). On the site every block sits
 * inside \`.${slug}-page\`, which sets the colours and type; a preview shows the block alone, so it needs the same wrapper.
 */
export class PreviewPageGround extends ThemeComponent<{ children?: ReactNode }> {
  render(): ReactNode {
    return <div className="${slug}-page ${slug}-page--preview">{this.props.children}</div>;
  }
}
`,
      'src/theme.config.ts': `import { ThemeIdentity } from '@theme/constants/theme-identity';
import { ThemeLayouts } from '@theme/layouts/theme-layouts';
import { ThemeLayoutCatalog } from '@theme/layouts/layout-catalog';
import { PreviewPageGround } from '@theme/components/preview-page-ground';

/** The theme's identity, in one place. */
export class ThemeConfig {
  static readonly slug = ThemeIdentity.SLUG;

  static layouts(): Record<string, unknown> {
    return ThemeLayouts.build();
  }

  static readonly defaultLayout = ThemeLayoutCatalog.DEFAULT_KEY;

  /** Slots this theme fills. The admin's block previews render a block without the site around it. */
  static readonly overrides: Record<string, unknown> = {
    'cms.preview.surface': PreviewPageGround,
  };
}
`,
      'src/theme-boot.ts': `import { ContextBridge } from '@fromcode119/sdk/react';
import { ThemeConfig } from '@theme/theme.config';
import bgTranslations from '@theme/i18n/bg.json';
import enTranslations from '@theme/i18n/en.json';

/**
 * Everything this theme does when it boots. The generated entry hands in the renderer maps built from
 * theme.json's \`build\` globs; this theme ships none, since the CMS and the plugins supply the blocks.
 */
export class ThemeBoot {
  static start(renderers: Record<string, () => Promise<unknown>>, eagerRenderers: Record<string, unknown>): void {
    void renderers;
    void eagerRenderers;
    // The 'theme' layer is the override layer: it wins over plugin defaults whatever the load order.
    ContextBridge.registerTranslations({ bg: bgTranslations, en: enTranslations }, 'theme');
    ContextBridge.registerTheme(ThemeConfig.slug, {
      layouts: ThemeConfig.layouts(),
      defaultLayout: ThemeConfig.defaultLayout,
      overrides: ThemeConfig.overrides,
    });
  }
}
`,
      'src/components/app.tsx': `import type { ReactNode } from 'react';
import { ThemeComponent } from '@theme/context/theme-component';

/** The site chrome around every page. Add the header, menu and footer here. */
export class App extends ThemeComponent {
  declare props: { page?: any; width?: string; children?: ReactNode };

  render(): ReactNode {
    const wide = this.props.width === 'wide';
    return (
      <div className="${slug}-page">
        <main className={wide ? '${slug}-main ${slug}-main--wide' : '${slug}-main'}>{this.props.children}</main>
      </div>
    );
  }
}
`,
    };
  }
}
