import path from 'path';

/** Compose's short value syntaxes, read the way `docker compose` reads them. */
export class ComposeValueParser {
  private static readonly UNITS: Record<string, number> = { '': 1, b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 };

  /** `512M`, `2g`, `1024` → bytes. */
  static bytes(value: unknown): number {
    const match = /^(\d+(?:\.\d+)?)\s*([bkmg]?)b?$/i.exec(String(value).trim());
    if (!match) throw new Error(`"${value}" is not a memory size.`);
    return Math.round(Number(match[1]) * ComposeValueParser.UNITS[match[2].toLowerCase()]);
  }

  /** A string command is split into words as a POSIX shell would (compose does the same); a list is kept. */
  static words(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    const words: string[] = [];
    let word = '';
    let quote = '';
    let started = false;
    const text = String(value);
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quote) {
        if (char === quote) quote = '';
        else if (char === '\\' && quote === '"' && index + 1 < text.length) word += text[++index];
        else word += char;
      } else if (char === '"' || char === "'") { quote = char; started = true; }
      else if (char === '\\' && index + 1 < text.length) { word += text[++index]; started = true; }
      else if (/\s/.test(char)) { if (started) words.push(word); word = ''; started = false; }
      else { word += char; started = true; }
    }
    if (quote) throw new Error(`Unclosed quote in "${text}".`);
    if (started) words.push(word);
    return words;
  }

  /** `unless-stopped`, `always`, `no`, `on-failure[:n]` → a Docker restart policy. */
  static restart(value: unknown): { Name: string; MaximumRetryCount?: number } {
    const [name, retries] = String(value).split(':');
    if (!['no', 'always', 'unless-stopped', 'on-failure'].includes(name)) throw new Error(`"${value}" is not a restart policy.`);
    return retries ? { Name: name, MaximumRetryCount: Number(retries) } : { Name: name === 'no' ? '' : name };
  }

  /** `[ip:][host:]container[/proto]`, IPv6 in brackets → the container port and its host binding. */
  static port(value: unknown): { containerPort: string; binding: { HostIp: string; HostPort: string } } {
    const text = String(value).trim();
    const [address, protocol = 'tcp'] = text.split('/');
    const ipv6 = /^\[([^\]]+)\]:(.*)$/.exec(address);
    const parts = ipv6 ? [ipv6[1], ...ipv6[2].split(':')] : address.split(':');
    if (parts.length < 1 || parts.length > 3 || parts.some((part, index) => index > 0 && !/^\d*$/.test(part))) throw new Error(`"${text}" is not a port mapping.`);
    const containerPort = parts[parts.length - 1];
    const hostPort = parts.length >= 2 ? parts[parts.length - 2] : '';
    const hostIp = parts.length === 3 ? parts[0] : '';
    return { containerPort: `${containerPort}/${protocol}`, binding: { HostIp: hostIp, HostPort: hostPort } };
  }

  /**
   * A short volume entry as a bind: a relative source is a path in the deployment folder on the HOST
   * (where the daemon resolves it), a plain name is the named volume compose created.
   */
  static volume(entry: unknown, hostDirectory: string, namedVolume: (key: string) => string | null): string {
    if (typeof entry !== 'string') throw new Error('Only the short volume syntax (source:target[:mode]) can be applied.');
    const [source, target, mode] = entry.split(':');
    if (!target) throw new Error(`"${entry}" names no path inside the container (an anonymous volume cannot be carried).`);
    let resolved = source;
    if (source.startsWith('.')) resolved = path.posix.resolve(hostDirectory, source);
    else if (!source.startsWith('/') && !source.startsWith('~')) {
      const named = namedVolume(source);
      if (!named) throw new Error(`The volume "${source}" is not declared under the compose files' volumes.`);
      resolved = named;
    }
    return [resolved, target, mode].filter(Boolean).join(':');
  }
}
