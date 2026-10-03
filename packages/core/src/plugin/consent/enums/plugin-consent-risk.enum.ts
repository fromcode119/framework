import { Enum } from '@fromcode119/react-class-components/lang';

/** How much harm an approved entry could do, as the consent dialog ranks it. */
export class PluginConsentRisk extends Enum {
  static readonly LOW = new PluginConsentRisk('low');
  static readonly MEDIUM = new PluginConsentRisk('medium');
  static readonly HIGH = new PluginConsentRisk('high');

  private constructor(value: string) {
    super(value);
  }
}
