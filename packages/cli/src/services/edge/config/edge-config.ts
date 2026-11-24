import fs from 'fs';
import YAML from 'yaml';
import { NetworkAddressUtils } from '@fromcode119/core';
import { EdgeOriginConfig } from '@cli/services/edge/config/edge-origin-config';

/**
 * What an edge does, from ONE file (YAML or JSON) — nothing about it is decided in code:
 *
 * ```yaml
 * listeners:
 *   - { port: 80, protocol: http }
 *   - { port: 443, protocol: tls, acceptProxyFrom: [203.0.113.10] }   # a relay in front of this edge
 * origins:
 *   - { name: shop, hosts: [shop.example.com], transport: tcp, address: 10.0.0.5, ports: { http: 8080, tls: 8443 }, proxyProtocol: true, health: { type: tcp } }
 *   - { name: platform, hosts: ["*"], transport: fromcode }
 * rules: { source: fromcode }          # or { source: file, path: /etc/fromcode-edge/rules.yaml }, or { source: none }
 * fromcode: { state: /var/lib/fromcode-edge }   # where `fromcode edge join` keeps this edge's key and certificate
 * status: { address: 127.0.0.1, port: 9901 }    # /health and /ready, for this machine only
 * ```
 *
 * A file that does not say exactly this is refused at start with every problem listed — never a quiet
 * start on half a configuration.
 */
export class EdgeConfig {
  static readonly HTTP = 'http';
  static readonly TLS = 'tls';
  static readonly RULES_NONE = 'none';
  static readonly RULES_FILE = 'file';
  static readonly RULES_FROMCODE = 'fromcode';

  constructor(
    readonly listeners: ReadonlyArray<{ port: number; protocol: string; acceptProxyFrom: readonly string[] }>,
    readonly origins: readonly EdgeOriginConfig[],
    readonly rules: { source: string; path: string },
    readonly state: string,
    readonly status: { address: string; port: number } | null,
  ) {}

  static load(file: string): EdgeConfig {
    let text: string;
    try { text = fs.readFileSync(file, 'utf8'); } catch (error: any) { throw new Error(`Edge configuration ${file}: cannot be read (${error?.code || error?.message}).`); }
    let raw: unknown;
    try { raw = YAML.parse(text); } catch (error: any) { throw new Error(`Edge configuration ${file}: not valid YAML or JSON — ${error?.message}`); }
    return EdgeConfig.parse(raw, file);
  }

  static parse(raw: unknown, source = 'configuration'): EdgeConfig {
    const problems: string[] = [];
    const root = EdgeConfig.object(raw);
    if (!root) throw new Error(`Edge ${source}: must be a mapping with listeners and origins.`);
    const listeners = EdgeConfig.list(root.listeners, 'listeners', problems).map((entry, index) => EdgeConfig.listener(entry, `listeners[${index}]`, problems));
    if (!listeners.length) problems.push('listeners: at least one port to listen on.');
    const ports = listeners.map((listener) => listener.port);
    if (new Set(ports).size !== ports.length) problems.push('listeners: a port is listed twice.');
    const origins = EdgeConfig.list(root.origins, 'origins', problems).map((entry, index) => EdgeConfig.origin(entry, `origins[${index}]`, problems, listeners.map((listener) => listener.protocol)));
    if (!origins.length) problems.push('origins: at least one server to pass connections to.');
    if (origins.filter((origin) => origin.isDefault).length > 1) problems.push('origins: only one may serve "*".');
    const names = origins.map((origin) => origin.name);
    if (new Set(names).size !== names.length) problems.push('origins: two have the same name.');

    const rulesRaw = EdgeConfig.object(root.rules) ?? {};
    const rules = { source: String(rulesRaw.source ?? EdgeConfig.RULES_NONE), path: String(rulesRaw.path ?? '') };
    if (![EdgeConfig.RULES_NONE, EdgeConfig.RULES_FILE, EdgeConfig.RULES_FROMCODE].includes(rules.source)) problems.push(`rules.source: "${rules.source}" — one of none, file, fromcode.`);
    if (rules.source === EdgeConfig.RULES_FILE && !rules.path) problems.push('rules.path: the rules file, for source "file".');
    const usesPlatform = rules.source === EdgeConfig.RULES_FROMCODE || origins.some((origin) => origin.transport === EdgeOriginConfig.FROMCODE);
    const state = String(EdgeConfig.object(root.fromcode)?.state ?? '');
    if (usesPlatform && !state) problems.push('fromcode.state: the directory this edge keeps its key and certificate in (see `fromcode edge join`).');

    const statusRaw = EdgeConfig.object(root.status);
    const status = statusRaw ? { address: String(statusRaw.address ?? ''), port: Number(statusRaw.port) } : null;
    if (status && (!NetworkAddressUtils.normalize(status.address) || !EdgeConfig.isPort(status.port))) problems.push('status: an address and a port, e.g. { address: 127.0.0.1, port: 9901 }.');

    if (problems.length) throw new Error(`Edge ${source} is not valid:\n  - ${problems.join('\n  - ')}`);
    return new EdgeConfig(listeners, origins, rules, state, status);
  }

  private static listener(raw: unknown, at: string, problems: string[]) {
    const value = EdgeConfig.object(raw) ?? {};
    const port = Number(value.port);
    const protocol = String(value.protocol ?? '');
    if (!EdgeConfig.isPort(port)) problems.push(`${at}.port: a port from 1 to 65535.`);
    if (![EdgeConfig.HTTP, EdgeConfig.TLS].includes(protocol)) problems.push(`${at}.protocol: http or tls.`);
    const acceptProxyFrom = EdgeConfig.strings(value.acceptProxyFrom, `${at}.acceptProxyFrom`, problems);
    for (const entry of acceptProxyFrom) if (!NetworkAddressUtils.isAddressOrBlock(entry)) problems.push(`${at}.acceptProxyFrom: "${entry}" is not an address or block.`);
    return { port, protocol, acceptProxyFrom };
  }

  private static origin(raw: unknown, at: string, problems: string[], protocols: string[]): EdgeOriginConfig {
    const value = EdgeConfig.object(raw) ?? {};
    const name = String(value.name ?? '').trim();
    if (!name) problems.push(`${at}.name: a name, for the logs.`);
    const hosts = EdgeConfig.strings(value.hosts, `${at}.hosts`, problems).map((host) => host.trim().toLowerCase());
    if (!hosts.length) problems.push(`${at}.hosts: the host names it serves, or "*".`);
    const transport = String(value.transport ?? '');
    const portsRaw = EdgeConfig.object(value.ports) ?? {};
    const ports: Record<string, number> = {};
    for (const [protocol, port] of Object.entries(portsRaw)) ports[protocol] = Number(port);
    const healthRaw = EdgeConfig.object(value.health) ?? {};
    const health = { type: String(healthRaw.type ?? (transport === EdgeOriginConfig.TCP ? 'tcp' : 'none')), path: String(healthRaw.path ?? '') };
    const address = String(value.address ?? '').trim();
    if (transport === EdgeOriginConfig.TCP) {
      if (!address) problems.push(`${at}.address: the server's host name or IP.`);
      for (const protocol of new Set(protocols)) if (!EdgeConfig.isPort(ports[protocol])) problems.push(`${at}.ports.${protocol}: the server's port for ${protocol} connections.`);
      if (!['http', 'tcp', 'none'].includes(health.type)) problems.push(`${at}.health.type: http, tcp or none.`);
      if (health.type === 'http' && (!health.path.startsWith('/') || !EdgeConfig.isPort(ports.http))) problems.push(`${at}.health: type http needs a path starting with "/" and ports.http.`);
      if (typeof value.proxyProtocol !== 'boolean') problems.push(`${at}.proxyProtocol: true or false — whether the server is told the visitor's address in a PROXY v2 header. Say which.`);
    } else if (transport !== EdgeOriginConfig.FROMCODE) {
      problems.push(`${at}.transport: tcp or fromcode.`);
    }
    return new EdgeOriginConfig(name, hosts, transport, address, ports, value.proxyProtocol === true || transport === EdgeOriginConfig.FROMCODE, health);
  }

  private static isPort(value: unknown): boolean {
    return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 65_535;
  }

  private static object(raw: unknown): Record<string, unknown> | null {
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  }

  private static list(raw: unknown, at: string, problems: string[]): unknown[] {
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) { problems.push(`${at}: a list.`); return []; }
    return raw;
  }

  private static strings(raw: unknown, at: string, problems: string[]): string[] {
    return EdgeConfig.list(raw, at, problems).map(String);
  }
}
