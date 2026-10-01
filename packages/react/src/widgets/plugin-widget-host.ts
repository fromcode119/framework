import { Context as ReactorContext } from '@fromcode119/react-class-components';

/**
 * Whether the tree below is a page plugin WIDGETS may appear on — the storefront, and nowhere else.
 *
 * `Slot` is shared by the storefront and the admin, and both can hold the same plugin list. A widget is
 * a storefront feature: a frame some plugin's manifest put in a slot must never open inside the console,
 * where the person looking holds the site's (or the platform's) rights. Off by default; only the
 * storefront's roots — its server render, its islands document and its App Router pages — turn it on.
 */
export class PluginWidgetHost {
  static readonly Context = new ReactorContext<boolean>(false).raw;
}
