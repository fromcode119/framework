import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The edge identity rows of the setting registry — Settings → Security → Edges. Platform-only: an
 * edge serves every site, and so does the authority that vouches for it.
 *
 * The seeds follow SPIFFE/SPIRE's defaults: a join token valid ten minutes, a short-lived identity
 * renewed at half its life. A short life is what makes revocation reliable without OCSP.
 */
export class EdgeIdentitySettingDescriptors {
  static readonly ALL = {
    [SystemConstants.META_KEY.EDGE_ENROLLMENT_TOKEN_MINUTES]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '10', description: "Minutes a one-time token for adding an edge stays valid. It works once; an unused one simply expires.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_CERTIFICATE_HOURS]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '24', description: "Hours an edge's certificate is valid. The edge renews it at half its life; a removed edge loses access when its certificate runs out, and at once on every new connection.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_CA_INTERMEDIATE_DAYS]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '30', description: "Days the platform signs edge certificates with one working certificate before replacing it. The previous one stays trusted until every certificate it signed has run out.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_CONTROL_ADDRESS]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '', description: "The host name or IP address edges dial to reach the platform. The gateway's certificate for the control channel is issued for it. Empty: no control channel, and no edge can be added.", group: "security" },
    },
    [SystemConstants.META_KEY.EDGE_CONTROL_PORT]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: '', description: "The port the gateway opens for edges: their rules, reports, certificate renewals and visitor traffic, all over mutual TLS. Empty: the gateway opens no port for edges.", group: "security" },
    },
  };
}
