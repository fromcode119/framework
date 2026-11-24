import type http from 'http';
import { InternalServiceAuth, NetworkAddressUtils } from '@fromcode119/core';

/**
 * Who may ask the gateway how it is.
 *
 * The health path used to answer anyone on the internet with the number of hosts, the internal names of
 * the apps behind it and how many certificates it holds — a map of the inside handed to every scanner.
 * Health is an internal question, so it is answered as one:
 *
 * - **details** (`hosts`, targets, certificates) only to a caller holding the internal secret — the api,
 *   which shows them in the console;
 * - **up or not** (`{"ok":true}`) to what checks liveness from inside: this machine, the private network
 *   the edge and the watchdog run on, and the Trusted relays (Settings → Security), which probe through
 *   the edge in front of this gateway;
 * - **nothing** to anyone else: the same 404 an unknown path gets, so the path does not even confirm
 *   that a gateway is here.
 *
 * The address judged is the one the connection carries after the PROXY header, which the listener only
 * reads from a Trusted relay: a visitor cannot claim to be inside by sending one.
 */
export class GatewayHealthAccess {
  constructor(private readonly relays: () => readonly string[]) {}

  detailed(req: http.IncomingMessage): boolean {
    return InternalServiceAuth.authorize(req.headers[InternalServiceAuth.HEADER]);
  }

  allowed(req: http.IncomingMessage): boolean {
    if (this.detailed(req)) return true;
    const address = req.socket?.remoteAddress;
    return NetworkAddressUtils.isPrivate(address) || NetworkAddressUtils.matchesAny(address, this.relays());
  }
}
