/**
 * The control channel's wire contract, shared by the gateway that serves it and the edge that uses it.
 *
 * One port carries two things, told apart by ALPN in the TLS handshake — the way large edges multiplex
 * control and traffic on one connection target:
 * - `CONTROL` — HTTP/1.1 requests from the edge: enroll, renew, rules, reports;
 * - `TUNNEL` — a visitor's connection, carried inside the edge's mutual TLS, PROXY header first.
 */
export class EdgeControlPaths {
  static readonly CONTROL = 'http/1.1';
  static readonly TUNNEL = 'fromcode-tunnel/1';
  /** The platform's root, unauthenticated: a joining edge checks it against the hash it was given, before it sends its token. */
  static readonly TRUST = '/edge/v1/trust';
  static readonly ENROLL = '/edge/v1/enroll';
  static readonly RENEW = '/edge/v1/renew';
  static readonly RULES = '/edge/v1/rules';
  static readonly REPORTS = '/edge/v1/reports';
  /** How long a rules request waits for a change before answering "nothing new". */
  static readonly RULES_WAIT_MS = 25_000;
}
