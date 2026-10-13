import { PluginSettingsRedirectPage } from '@/app/plugins/[slug]/settings/page.client';

/** `/plugins/installed/<slug>/settings` — opens the plugin's Settings tab, as `/plugins/<slug>/settings` does. */
export class InstalledPluginSettingsRedirectPage extends PluginSettingsRedirectPage {}
