import net from 'net';

/**
 * Reads the PROXY protocol (v2) header the `edge` service puts in front of every connection it passes
 * on, so the gateway knows who the visitor is.
 *
 * `edge` forwards raw TCP (it must: the gateway terminates TLS itself), so the socket the gateway sees
 * comes from `edge`, not the visitor. Without the header every direct visitor would look like `edge`'s
 * private address — and the api, which trusts private hops in `X-Forwarded-For`, would put them all
 * in one rate-limit bucket.
 *
 * OPTIONAL per connection. Callers on the container network (the api pushing a routing reload, a
 * health check) connect directly and send no header; that is only possible from inside, because the
 * gateway publishes no port of its own once `edge` owns 80 and 443. A connection that starts with the
 * signature is read; any other is handed on untouched.
 */
export class GatewayProxyProtocol {
  /** `\r\n\r\n\0\r\nQUIT\n` — the fixed start of every v2 header. */
  static readonly SIGNATURE = Buffer.from([0x0d, 0x0a, 0x0d, 0x0a, 0x00, 0x0d, 0x0a, 0x51, 0x55, 0x49, 0x54, 0x0a]);
  private static readonly FIXED_BYTES = 16;
  private static readonly MAX_BYTES = 16 + 536;
  private static readonly HEADER_TIMEOUT_MS = 10_000;

  /**
   * Hands `socket` to `deliver` once its header (if any) is consumed, with `remoteAddress` and
   * `remotePort` telling the visitor. A malformed header closes the connection.
   *
   * `resume: false` leaves the socket paused after `deliver`, for a caller that first opens a connection
   * of its own (`PlatformEdge` relaying a relay) and would otherwise lose the bytes read meanwhile.
   */
  static accept(socket: net.Socket, deliver: (socket: net.Socket) => void, options: { resume?: boolean } = {}): void {
    let buffered = Buffer.alloc(0);
    const timer = setTimeout(() => socket.destroy(), GatewayProxyProtocol.HEADER_TIMEOUT_MS);
    const finish = (rest: Buffer): void => {
      clearTimeout(timer);
      socket.removeListener('readable', onReadable);
      socket.removeListener('end', onEnd);
      if (rest.length) socket.unshift(rest);
      deliver(socket);
      if (options.resume !== false) socket.resume();
    };
    const onEnd = (): void => { clearTimeout(timer); };
    const onReadable = (): void => {
      let chunk: Buffer | null;
      while ((chunk = socket.read()) !== null) buffered = Buffer.concat([buffered, chunk]);
      const decided = GatewayProxyProtocol.decide(buffered);
      if (decided === null) return;
      if (decided === false) { finish(buffered); return; }
      if (decided === 'invalid') { clearTimeout(timer); socket.destroy(); return; }
      GatewayProxyProtocol.present(socket, decided.address, decided.port);
      finish(buffered.subarray(decided.length));
    };
    socket.on('readable', onReadable);
    socket.on('end', onEnd);
  }

  /**
   * What the bytes so far say: `false` — no header, hand on as is; `null` — too few bytes to tell;
   * `'invalid'` — a header that cannot be read; or the visitor and the header's length.
   */
  static decide(bytes: Buffer): false | null | 'invalid' | { address: string | null; port: number | null; length: number } {
    const prefix = Math.min(bytes.length, GatewayProxyProtocol.SIGNATURE.length);
    if (!bytes.subarray(0, prefix).equals(GatewayProxyProtocol.SIGNATURE.subarray(0, prefix))) return false;
    if (bytes.length < GatewayProxyProtocol.FIXED_BYTES) return null;
    const versionCommand = bytes[12];
    if ((versionCommand & 0xf0) !== 0x20) return 'invalid';
    const length = GatewayProxyProtocol.FIXED_BYTES + bytes.readUInt16BE(14);
    if (length > GatewayProxyProtocol.MAX_BYTES) return 'invalid';
    if (bytes.length < length) return null;
    // LOCAL (a health check from `edge` itself) carries no visitor: keep the socket's own address.
    if ((versionCommand & 0x0f) === 0x00) return { address: null, port: null, length };
    const family = bytes[13] >> 4;
    const body = bytes.subarray(GatewayProxyProtocol.FIXED_BYTES, length);
    if (family === 0x1 && body.length >= 12) return { address: [...body.subarray(0, 4)].join('.'), port: body.readUInt16BE(8), length };
    if (family === 0x2 && body.length >= 36) {
      const groups: string[] = [];
      for (let i = 0; i < 16; i += 2) groups.push(body.readUInt16BE(i).toString(16));
      return { address: groups.join(':'), port: body.readUInt16BE(32), length };
    }
    return { address: null, port: null, length };
  }

  /** The visitor as the gateway's servers (and `xfwd`) read it: the socket's own properties. */
  private static present(socket: net.Socket, address: string | null, port: number | null): void {
    if (address) Object.defineProperty(socket, 'remoteAddress', { value: address, configurable: true });
    if (port !== null) Object.defineProperty(socket, 'remotePort', { value: port, configurable: true });
  }

  /**
   * A v2 header naming `source` as the visitor — what `edge` writes ahead of every connection it passes
   * on. IPv4 (including IPv4-mapped IPv6, as Node reports it on a dual-stack socket) or IPv6.
   */
  static header(source: string, sourcePort: number, destination = '0.0.0.0', destinationPort = 0): Buffer {
    const v4 = (address: string): string | null => {
      const plain = address.startsWith('::ffff:') ? address.slice(7) : address;
      return net.isIPv4(plain) ? plain : null;
    };
    const from4 = v4(source);
    const to4 = v4(destination) ?? '0.0.0.0';
    const fixed = Buffer.alloc(4);
    fixed[0] = 0x21;
    let body: Buffer;
    if (from4) {
      fixed[1] = 0x11;
      body = Buffer.alloc(12);
      from4.split('.').forEach((part, i) => body.writeUInt8(Number(part), i));
      to4.split('.').forEach((part, i) => body.writeUInt8(Number(part), 4 + i));
      body.writeUInt16BE(sourcePort, 8);
      body.writeUInt16BE(destinationPort, 10);
    } else {
      fixed[1] = 0x21;
      body = Buffer.alloc(36);
      GatewayProxyProtocol.ipv6Bytes(source).copy(body, 0);
      GatewayProxyProtocol.ipv6Bytes(net.isIPv6(destination) ? destination : '::').copy(body, 16);
      body.writeUInt16BE(sourcePort, 32);
      body.writeUInt16BE(destinationPort, 34);
    }
    fixed.writeUInt16BE(body.length, 2);
    return Buffer.concat([GatewayProxyProtocol.SIGNATURE, fixed, body]);
  }

  /** The 16 bytes of an IPv6 address (`::` expanded). */
  private static ipv6Bytes(address: string): Buffer {
    const [head, tail] = address.split('::');
    const left = head ? head.split(':') : [];
    const right = tail !== undefined && tail ? tail.split(':') : [];
    const groups = [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
    const out = Buffer.alloc(16);
    groups.slice(0, 8).forEach((group, i) => out.writeUInt16BE(parseInt(group || '0', 16), i * 2));
    return out;
  }
}
