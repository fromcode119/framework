import { Enum } from '@fromcode119/react-class-components/lang';

/** Whose approval it is: the platform's (installed for every site) or one site's own plugin. */
export class PluginConsentScope extends Enum {
  static readonly PLATFORM = new PluginConsentScope('platform');
  static readonly SITE = new PluginConsentScope('site');

  private constructor(value: string) {
    super(value);
  }
}
