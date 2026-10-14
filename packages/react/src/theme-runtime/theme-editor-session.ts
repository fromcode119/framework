import { BrowserStateClient } from '@fromcode119/core/client';

/**
 * Whether this page load is a CMS visual-editor session. Only then does the layout shell route the page
 * through the editor's app-shell slot; for everyone else that swap would remount the page.
 */
export class ThemeEditorSession {
  private static readonly browserState = new BrowserStateClient();

  private static readonly EDITOR_PARAMS = ['edit', 'preview', 'cms', 'draft'];

  static isActive(): boolean {
    return ThemeEditorSession.EDITOR_PARAMS.some(
      (name) => ThemeEditorSession.browserState.readQueryParamFromWindow(name) !== '',
    );
  }
}
