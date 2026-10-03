import { Enum } from '@fromcode119/react-class-components/lang';

/** What one entry of a consent set is: a capability, one host, or every host. */
export class PluginConsentEntryKind extends Enum {
  static readonly CAPABILITY = new PluginConsentEntryKind('capability');
  static readonly HOST = new PluginConsentEntryKind('host');
  static readonly ANY_HOST = new PluginConsentEntryKind('anyHost');

  private constructor(value: string) {
    super(value);
  }
}
