import type { IPluginMediaIngestInput } from '@core/plugin/interfaces/plugin-media-ingest-input.interface';

/**
 * The in-plugin media WRITE path: `context.media.ingest()` forwards here.
 *
 * Storing a file is the media manager's job and fetching one by url needs the api's SSRF-guarded
 * fetch — both live in the api, which core cannot import. So the api PUSHES its ingest function in
 * at boot, the same inversion as `CollectionWriteBridge`. A plugin therefore stores media through the
 * exact path the MCP media tools use: the same address checks, the same size cap, the same row.
 *
 * Fail-closed: before the api installs the ingester, a call throws rather than writing some other way.
 */
export class MediaIngestBridge {
  private static ingester: ((input: IPluginMediaIngestInput) => Promise<Record<string, unknown>>) | null = null;

  static install(ingester: (input: IPluginMediaIngestInput) => Promise<Record<string, unknown>>): void {
    MediaIngestBridge.ingester = ingester;
  }

  static async ingest(input: IPluginMediaIngestInput): Promise<Record<string, unknown>> {
    if (!MediaIngestBridge.ingester) {
      throw new Error('Media ingest is unavailable: the api installs the media ingest bridge at boot, and it has not run.');
    }
    return MediaIngestBridge.ingester(input);
  }
}
