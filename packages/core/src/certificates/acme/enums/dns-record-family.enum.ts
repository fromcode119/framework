import { Enum } from '@fromcode119/react-class-components';

/**
 * Which address family a DNS lookup asks for.
 *
 * The `.value` is Node's own `dns/promises` METHOD NAME, which is why it reads the way it does: the
 * caller picks a family and the resolver calls `dns[family]`. Both the ACME preflight and the
 * platform-address detection do this, and a mistyped method name there is not an error — it is
 * `undefined`, and the host silently appears to resolve to nothing.
 */
export class DnsRecordFamily extends Enum {
  /** IPv4 — `dns.resolve4`. */
  static readonly IPV4 = new DnsRecordFamily('resolve4');

  /** IPv6 — `dns.resolve6`. */
  static readonly IPV6 = new DnsRecordFamily('resolve6');

  private constructor(value: string) {
    super(value);
  }
}
