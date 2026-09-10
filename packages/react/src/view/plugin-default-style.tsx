import type { ReactNode } from 'react';
import { Platform, PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * A plugin's DEFAULT stylesheet (Plugin-Owns-Default-Design), delivered the same way on both sides of
 * the render so a default-styled surface never reflows at hydration:
 *
 *  - **server render:** emitted inline as `<style data-fc-plugin-default="<key>">`. The frontend lifts
 *    every tag carrying that marker out of the body and into `<head>` AHEAD of the theme's stylesheet
 *    (`ThemeSsrMarkup`), so the first paint is styled and an equal-specificity theme override still wins
 *    on load order. A renderer that only injected on mount painted UNSTYLED on the server and shifted the
 *    whole block once the browser injected the sheet — a 0.64 CLS on a contact page.
 *  - **browser:** renders nothing (matching the lifted server markup) and, on mount, prepends the sheet
 *    to `<head>` once per key — unless the server's lifted copy is already there, which it adopts.
 *
 * Deliberately NOT a cascade layer: an unlayered global reset (`* { padding: 0 }`) would beat layered
 * defaults and strip the design's own spacing. Prepending keeps plain cascade semantics.
 */
export class PluginDefaultStyle extends PureReactor {
  /** Unique per surface: `<plugin>-<surface>` (`ecommerce-collection`, `forms-contact`). */
  @prop declare styleKey: string;
  /** The sheet's text — the plugin's `.css` file imported as text. */
  @prop declare css: string;

  static readonly ATTRIBUTE = 'data-fc-plugin-default';

  private static readonly injected = new Set<string>();

  componentDidMount(): void {
    PluginDefaultStyle.inject(this.styleKey, this.css);
  }

  /** Prepends the sheet to `<head>` once per key; adopts a lifted server copy when one is present. */
  static inject(styleKey: string, css: string): void {
    if (!Platform.isBrowser || !styleKey || PluginDefaultStyle.injected.has(styleKey)) return;
    PluginDefaultStyle.injected.add(styleKey);
    if (document.head.querySelector(`style[${PluginDefaultStyle.ATTRIBUTE}="${styleKey}"]`)) return;
    const element = document.createElement('style');
    element.setAttribute(PluginDefaultStyle.ATTRIBUTE, styleKey);
    element.textContent = String(css || '');
    document.head.prepend(element);
  }

  render(): ReactNode {
    if (Platform.isBrowser) return null;
    return <style data-fc-plugin-default={this.styleKey} dangerouslySetInnerHTML={{ __html: String(this.css || '') }} />;
  }
}
