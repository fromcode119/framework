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
    [SystemConstants.META_KEY.EDGE_BLOCK_ATTACK_PATTERNS]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: 'false', description: "Refuse requests that carry a known attack in their address (403): SQL injection (union select, ' or 1=1, sleep(), information_schema), script injection (<script, javascript:, onerror=), path traversal (../) and Log4Shell (${jndi:), plus the blocked paths and blocked tools below. Every site.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_BLOCKED_PATHS]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '/.env\n/.git/\n/.aws/\n/.ssh/\n/.DS_Store\n/wp-admin\n/wp-login.php\n/xmlrpc.php\n/phpmyadmin\n/pma/\n/cgi-bin/\n/vendor/phpunit\n/server-status\n/actuator', description: "Path prefixes refused while attack blocking is on, one per line: what scanners probe for and no site here serves.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_BLOCKED_USER_AGENTS]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: 'sqlmap\nnikto\nnuclei\nmasscan\nzgrab\nnmap\nacunetix\nwpscan\ngobuster\ndirbuster\nffuf', description: "Attack tools refused by the name they send (User-Agent, any part, any case), one per line, while attack blocking is on.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_BLOCKED_COUNTRIES]: {
      scope: SettingScope.INHERITED, writable: true, exposed: true,
      seed: { value: '', description: "Visitors from these countries are refused (403), by two-letter code, one per line or comma separated (e.g. KP, RU). Found from the visitor's address with the platform's geo database. On the platform it applies to every site that has not set its own. Empty: none.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_CHALLENGED_COUNTRIES]: {
      scope: SettingScope.INHERITED, writable: true, exposed: true,
      seed: { value: '', description: "Visitors from these countries always pass the browser check first, even while the site is not under attack. Two-letter codes. On the platform it applies to every site that has not set its own. Empty: none.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_BLOCKED_ADDRESSES]: {
      scope: SettingScope.INHERITED, writable: true, exposed: true,
      seed: { value: '', description: "Addresses or CIDR blocks refused (403), one per line. On the platform it applies to every site that has not set its own. Empty: none.", group: "security" },
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
