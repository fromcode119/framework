import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The edge protection rows of the setting registry — Settings → Security → Edge protection.
 *
 * "Under attack" is per SITE: each site switches it for its own hosts, and the platform row covers
 * the platform's own hosts (its console, marketplace). Everything about the check itself is the
 * platform's, because one gateway serves every site.
 */
export class EdgeProtectionSettingDescriptors {
  static readonly ALL = {
    [SystemConstants.META_KEY.EDGE_UNDER_ATTACK]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'false', description: "Under attack mode: every visitor passes a browser check at the gateway before reaching the site. Paths listed as exempt are never checked.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_CHALLENGE_CLEARANCE_MINUTES]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '720', description: "Minutes a visitor who passed the browser check is let in without another check.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_CHALLENGE_EXEMPT_PATHS]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '/api/\n/.well-known/', description: "Path prefixes the browser check never applies to, one per line: the api (apps, payment and courier webhooks) and certificate validation.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_CHALLENGE_TITLE]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: 'Checking your browser', description: "Heading of the browser check page.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_CHALLENGE_MESSAGE]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: 'This site is protecting itself from automated traffic. You will be taken there in a moment.', description: "Message on the browser check page.", group: "security" },
    },
  };
}
