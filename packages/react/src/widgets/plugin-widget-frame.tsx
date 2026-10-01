import type { ReactNode } from 'react';
import { ApiPathUtils, CoercionUtils } from '@fromcode119/core/client';
import { Reactor, prop } from '@fromcode119/react-class-components';

/**
 * One plugin WIDGET: a frame in a theme slot, showing one of the plugin's own routes.
 *
 * The frame is how a plugin a SITE uploaded appears on the storefront at all — it may put no code into
 * the site's pages (TenantPluginPackagePolicy). Sandboxed WITHOUT `allow-same-origin`, it runs in an
 * opaque origin: it cannot read the page around it, the visitor's cookies or storage, or what is typed
 * anywhere but into the widget itself. No referrer is sent, so it never learns which page (or which
 * reset-password link) it is shown on.
 *
 * Built from the plugin descriptor alone — a relative `src`, a fixed height — so the server render and
 * the browser produce the same markup and hydration matches.
 */
export class PluginWidgetFrame extends Reactor {
  static readonly SANDBOX = 'allow-scripts allow-forms allow-popups';
  /** The height a widget gets when its manifest names none, in CSS pixels. */
  static readonly DEFAULT_HEIGHT = 160;

  @prop declare pluginSlug: string;
  @prop declare path: string;
  @prop declare height?: number;
  @prop declare title?: string;

  render(): ReactNode {
    const height = CoercionUtils.toNumber(this.height);
    return (
      <iframe
        className="fc-plugin-widget"
        src={ApiPathUtils.pluginPath(this.pluginSlug, this.path)}
        sandbox={PluginWidgetFrame.SANDBOX}
        referrerPolicy="no-referrer"
        loading="lazy"
        height={height > 0 ? height : PluginWidgetFrame.DEFAULT_HEIGHT}
        title={CoercionUtils.toString(this.title) || this.pluginSlug}
        data-plugin={this.pluginSlug}
      />
    );
  }
}
