import { EdgeConfig } from '@cli/services/edge/config/edge-config';
import { EdgeOriginConfig } from '@cli/services/edge/config/edge-origin-config';
import { EdgeTcpOrigin } from '@cli/services/edge/origins/edge-tcp-origin';
import { EdgeTunnelOrigin } from '@cli/services/edge/origins/edge-tunnel-origin';
import { EdgeIdentityStore } from '@cli/services/edge/platform/edge-identity-store';
import { EdgeFileRules } from '@cli/services/edge/rules/edge-file-rules';
import { EdgePlatformRules } from '@cli/services/edge/rules/edge-platform-rules';
import { EdgeStaticRules } from '@cli/services/edge/rules/edge-static-rules';
import { PlatformEdge } from '@cli/services/edge/platform-edge';
import type { IEdgeRuleSource } from '@cli/services/edge/interfaces/edge-rule-source.interface';

/**
 * An edge built from its configuration file. A configuration that uses a Fromcode platform needs this
 * edge to have joined one (`fromcode edge join`); one that has not is refused with that instruction,
 * never started half-way.
 */
export class EdgeFactory {
  static build(config: EdgeConfig, version: string): { edge: PlatformEdge; identity: EdgeIdentityStore | null } {
    const needsPlatform = config.rules.source === EdgeConfig.RULES_FROMCODE || config.origins.some((origin) => origin.transport === EdgeOriginConfig.FROMCODE);
    const identity = needsPlatform ? new EdgeIdentityStore(config.state, version) : null;
    if (identity && !identity.load()) {
      throw new Error(`This edge has not joined a platform yet (nothing in ${config.state}). Run the join command from Settings → Security → Edges → Add edge.`);
    }
    const rules: IEdgeRuleSource = config.rules.source === EdgeConfig.RULES_FILE
      ? new EdgeFileRules(config.rules.path)
      : config.rules.source === EdgeConfig.RULES_FROMCODE ? new EdgePlatformRules(identity!, config.state, version) : new EdgeStaticRules();
    const origins = config.origins.map((origin) => (origin.transport === EdgeOriginConfig.FROMCODE ? new EdgeTunnelOrigin(origin, identity!) : new EdgeTcpOrigin(origin)));
    return { edge: new PlatformEdge(config.listeners, origins, rules), identity };
  }
}
