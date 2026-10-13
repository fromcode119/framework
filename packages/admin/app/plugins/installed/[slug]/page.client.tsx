import { PluginDetailPage } from '@/app/plugins/[slug]/page.client';

/**
 * A plugin's page at `/plugins/installed/<slug>` — the address the admin links to.
 *
 * `/plugins/<slug>` cannot serve a plugin whose slug is also one of the admin's own pages under
 * `/plugins/` (`installed`, `health`, `marketplace`): Next resolves the static route first. Under
 * `installed/` no static sibling exists, so every slug reaches its page.
 */
export class InstalledPluginDetailPage extends PluginDetailPage {}
