/**
 * The host a connection is for, read from its first bytes without terminating anything:
 * the server name (SNI) of a TLS ClientHello, or the `Host` header of an HTTP request.
 *
 * Each reader answers `undefined` while it needs more bytes, `''` when the bytes are complete but name
 * no host, and the host otherwise (lower case, no port).
 */
export class EdgeHello {
  /** The SNI host of a TLS ClientHello at the start of `bytes`. */
  static tlsHost(bytes: Buffer): string | undefined {
    if (bytes.length < 5) return undefined;
    if (bytes[0] !== 0x16) return ''; // not a handshake record
    const recordLength = bytes.readUInt16BE(3);
    if (bytes.length < 5 + recordLength) return recordLength > 16_384 ? '' : undefined;
    const hello = bytes.subarray(5, 5 + recordLength);
    if (hello.length < 4 || hello[0] !== 0x01) return '';
    let at = 4 + 2 + 32; // handshake header, version, random
    if (hello.length < at + 1) return '';
    at += 1 + hello[at]; // session id
    if (hello.length < at + 2) return '';
    at += 2 + hello.readUInt16BE(at); // cipher suites
    if (hello.length < at + 1) return '';
    at += 1 + hello[at]; // compression methods
    if (hello.length < at + 2) return '';
    const end = Math.min(hello.length, at + 2 + hello.readUInt16BE(at));
    at += 2;
    while (at + 4 <= end) {
      const type = hello.readUInt16BE(at);
      const length = hello.readUInt16BE(at + 2);
      const body = hello.subarray(at + 4, at + 4 + length);
      if (type === 0x0000 && body.length >= 5 && body[2] === 0x00) {
        const nameLength = body.readUInt16BE(3);
        return EdgeHello.clean(body.subarray(5, 5 + nameLength).toString('ascii'));
      }
      at += 4 + length;
    }
    return '';
  }

  /** The `Host` of the HTTP request at the start of `bytes`. */
  static httpHost(bytes: Buffer): string | undefined {
    const text = bytes.toString('latin1');
    const end = text.indexOf('\r\n\r\n');
    if (end < 0) return bytes.length >= 16_384 ? '' : undefined;
    const line = text.slice(0, end).split('\r\n').slice(1).find((header) => /^host\s*:/i.test(header));
    return line ? EdgeHello.clean(line.slice(line.indexOf(':') + 1)) : '';
  }

  private static clean(host: string): string {
    const value = host.trim().toLowerCase();
    const bracket = value.startsWith('[') ? value.slice(0, value.indexOf(']') + 1) : value.replace(/:\d+$/, '');
    return /^[a-z0-9.\-:[\]]{1,253}$/.test(bracket) ? bracket : '';
  }
}
