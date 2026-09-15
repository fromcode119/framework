import { Enum } from '@fromcode119/react-class-components';

/**
 * WHICH layer decided a dataset's erasure strategy.
 *
 * Ordered innermost first, and that order is the resolution order: a per-run choice beats the site's
 * standing policy, which beats the platform default, which beats the strategy the owning plugin
 * declared. Every answer names its layer, because an operator must never read a fallback as a
 * decision somebody made.
 */
export class PersonalDataPolicyLayer extends Enum {
  /** This run only — a legal hold on one subject, which leaves standing policy alone. */
  static readonly REQUEST = new PersonalDataPolicyLayer('request', 'Chosen for this request');
  /** This site's standing policy. The site controls the data, so it wins over the platform. */
  static readonly SITE = new PersonalDataPolicyLayer('site', 'Site policy (Settings → Personal data)');
  /** The default across every site on the deployment. */
  static readonly PLATFORM = new PersonalDataPolicyLayer('platform', 'Platform default (Settings → Personal data)');
  /** Nobody chose: the dataset's own declared default applies, named with the plugin that declared it. */
  static readonly DECLARED = new PersonalDataPolicyLayer('declared', 'Default declared by');

  private constructor(value: string, readonly label: string) {
    super(value);
  }
}
