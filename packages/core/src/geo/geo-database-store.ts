import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import zlib from 'zlib';
import { ProjectPaths } from '@core/config/paths';
import { GeoDatabaseSource } from '@core/geo/geo-database-source';

/**
 * The IP-location database on disk: `<data>/geo/`.
 *
 * One file, `city.mmdb`, replaced atomically (written beside it, then renamed), so a process reading it
 * never sees half a file; and `state.json`, which records the installed edition and the last attempt.
 * `<data>` is shared by the api and the extension host, so the api downloads and both read.
 */
export class GeoDatabaseStore {
  static readonly FILE = 'city.mmdb';
  private static readonly STATE = 'state.json';

  constructor(private readonly directory: string = path.join(ProjectPaths.getDataDir(), 'geo')) {}

  get databasePath(): string {
    return path.join(this.directory, GeoDatabaseStore.FILE);
  }

  /** The recorded state, or an empty one. Never throws: an unreadable state reads as "nothing installed". */
  readState(): { edition: string; installedAt: string; lastCheckedAt: string; lastError: string } {
    const empty = { edition: '', installedAt: '', lastCheckedAt: '', lastError: '' };
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(this.directory, GeoDatabaseStore.STATE), 'utf8'));
      return { ...empty, ...parsed };
    } catch {
      return empty;
    }
  }

  writeState(patch: Partial<{ edition: string; installedAt: string; lastCheckedAt: string; lastError: string }>): void {
    fs.mkdirSync(this.directory, { recursive: true });
    const next = { ...this.readState(), ...patch };
    const target = path.join(this.directory, GeoDatabaseStore.STATE);
    fs.writeFileSync(`${target}.tmp`, JSON.stringify(next, null, 2));
    fs.renameSync(`${target}.tmp`, target);
  }

  sizeBytes(): number {
    try {
      return fs.statSync(this.databasePath).size;
    } catch {
      return 0;
    }
  }

  /**
   * Download `edition`, gunzip it to a temporary file and move it into place. Throws with the HTTP status
   * for an edition that is not published (DB-IP answers 404 until the month's file exists).
   */
  async install(edition: string, fetcher: typeof fetch = fetch): Promise<void> {
    const response = await fetcher(GeoDatabaseSource.downloadUrl(edition));
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status} for edition ${edition}`);
    }
    fs.mkdirSync(this.directory, { recursive: true });
    const temporary = `${this.databasePath}.${process.pid}.download`;
    try {
      await pipeline(Readable.fromWeb(response.body as any), zlib.createGunzip(), fs.createWriteStream(temporary));
      fs.renameSync(temporary, this.databasePath);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
    this.writeState({ edition, installedAt: new Date().toISOString(), lastError: '' });
  }
}
