import path from 'path';

/**
 * Reads the regular files out of the tar stream Docker answers `GET /containers/{id}/archive` with.
 *
 * Only what that endpoint writes is understood: ustar headers, PAX `path=` records (Go's archive/tar uses
 * them for long names) and directories. Links, devices and anything else are skipped, never followed. A
 * name that is absolute or climbs out with `..` is refused — the names come from an image, and they are
 * about to become paths on the host.
 */
export class TarArchiveReader {
  private static readonly BLOCK = 512;

  /** Each regular file, keyed by its path below the archived directory itself (`deploy/x.yml` → `x.yml`). */
  static files(archive: Buffer): Map<string, Buffer> {
    const files = new Map<string, Buffer>();
    let offset = 0;
    let paxPath = '';
    while (offset + TarArchiveReader.BLOCK <= archive.length) {
      const header = archive.subarray(offset, offset + TarArchiveReader.BLOCK);
      if (header.every((byte) => byte === 0)) break;
      const size = parseInt(TarArchiveReader.text(header, 124, 12) || '0', 8);
      const type = String.fromCharCode(header[156] || 48);
      const body = archive.subarray(offset + TarArchiveReader.BLOCK, offset + TarArchiveReader.BLOCK + size);
      offset += TarArchiveReader.BLOCK + Math.ceil(size / TarArchiveReader.BLOCK) * TarArchiveReader.BLOCK;
      if (type === 'x') { paxPath = TarArchiveReader.paxPath(body); continue; }
      const prefix = TarArchiveReader.text(header, 345, 155);
      const name = paxPath || (prefix ? `${prefix}/${TarArchiveReader.text(header, 0, 100)}` : TarArchiveReader.text(header, 0, 100));
      paxPath = '';
      if (type !== '0') continue;
      files.set(TarArchiveReader.relative(name), Buffer.from(body));
    }
    return files;
  }

  /** `deploy/edge/relay/x.cfg` → `edge/relay/x.cfg`; refuses anything that would leave the directory. */
  static relative(name: string): string {
    const normal = path.posix.normalize(name);
    if (path.posix.isAbsolute(normal) || normal.split('/').includes('..')) throw new Error(`The release archive names "${name}", outside its folder.`);
    const [, ...rest] = normal.split('/');
    if (!rest.length) throw new Error(`The release archive holds "${name}" outside a folder.`);
    return rest.join('/');
  }

  private static paxPath(body: Buffer): string {
    for (const record of body.toString('utf8').split('\n')) {
      const match = /^\d+ path=(.*)$/.exec(record);
      if (match) return match[1];
    }
    return '';
  }

  private static text(header: Buffer, start: number, length: number): string {
    const field = header.subarray(start, start + length);
    const end = field.indexOf(0);
    return field.subarray(0, end === -1 ? field.length : end).toString('utf8').trim();
  }
}
