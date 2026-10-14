import type { ReactNode } from 'react';
import { Bridge, prop } from '@fromcode119/react-class-components';
import { ContextHooks } from '@react/context-hooks/context-hooks';
import { PageStyleProvider } from '@react/page-style-provider';
import { Slot } from '@react/slot';
import { ThemeProvider } from '@react/theme-runtime/theme-provider';
import { ThemeEditorSession } from '@react/theme-runtime/theme-editor-session';

/**
 * What every theme layout is wrapped in: the page style provider, the theme runtime, and, for CMS editor
 * sessions only, the editor's app-shell slot (a plain visitor keeps a tree whose identity never changes).
 * A Bridge because the style variants are reachable only through a hook.
 */
export class ThemeLayoutShell extends Bridge<{ themeStyleVariants: unknown }> {
  @prop declare page: any;

  @prop declare children: ReactNode;

  protected read(): { themeStyleVariants: unknown } {
    return { themeStyleVariants: ContextHooks.usePlugins().themeStyleVariants };
  }

  private get body(): ReactNode {
    return ThemeEditorSession.isActive()
      ? <Slot name="frontend.editor.app-shell" props={{ page: this.page, children: this.children }} fallback={this.children} />
      : this.children;
  }

  protected present({ themeStyleVariants }: { themeStyleVariants: unknown }): ReactNode {
    return (
      <PageStyleProvider page={this.page} themeStyleVariants={themeStyleVariants as any}>
        <ThemeProvider>{this.body}</ThemeProvider>
      </PageStyleProvider>
    );
  }
}
