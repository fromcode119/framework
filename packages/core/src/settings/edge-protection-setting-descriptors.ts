import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The edge protection rows of the setting registry — Settings → Security → Edge protection.
 *
 * "Under attack" is INHERITED: the platform console's switch covers every site and the platform's own
 * hosts, and a site that sets its own value (from its own console) overrides it for that site — one
 * switch for everything during an attack, and a way to spare or single out a site. Everything about
 * the check itself is the platform's, because one gateway serves every site.
 */
export class EdgeProtectionSettingDescriptors {
  static readonly ALL = {
    [SystemConstants.META_KEY.EDGE_UNDER_ATTACK]: {
      scope: SettingScope.INHERITED, writable: true, exposed: true,
      seed: { value: 'false', description: "Under attack mode: every visitor passes a browser check at the gateway before reaching the site. On the platform it applies to every site that has not set its own; a site's own value overrides it. Paths listed as exempt are never checked.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_CHALLENGE_CLEARANCE_MINUTES]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '720', description: "Minutes a visitor who passed the browser check is let in without another check.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_CHALLENGE_EXEMPT_PATHS]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '/api/\n/.well-known/\n/manifest.webmanifest', description: "Path prefixes the browser check never applies to, one per line: the api (apps, payment and courier webhooks), certificate validation, and the web app manifest (browsers fetch it without cookies, so it can never carry a pass).", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_RATE_LIMIT_PER_MINUTE]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '0', description: "Requests one visitor (one address) may make to any site per minute, at the gateway, before getting \"429 Too Many Requests\" for the rest of that minute. Counts pages, files and api calls together; the platform's own servers are never counted. 0 = no limit.", group: "security" },
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
