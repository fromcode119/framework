import { RequestContextUtils } from '@core/context/request-context';
import { RealtimeRoomTokens } from '@core/realtime/realtime-room-tokens';
import { ProcessSignals } from '@core/signals/process-signals';
import { ProcessSignal } from '@core/signals/enums/process-signal.enum';
import { TenantMode } from '@core/tenant/tenant-mode';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { IPluginContextRealtime } from '@core/plugin/interfaces/plugin-context-realtime.interface';

/**
 * `context.realtime` — see {@link IPluginContextRealtime}.
 *
 * Built on the HOST: an isolated plugin mints with a key it never sees, and its events leave through
 * the api's own sockets. The room is always prefixed with the calling plugin's slug here, never by the
 * plugin, so the prefix cannot be chosen.
 */
export class RealtimeContextProxy {
  /** An event is a live nudge, not a document: a payload past this is refused rather than fanned out. */
  static readonly MAX_EVENT_BYTES = 64 * 1024;
  private static readonly TYPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,79}$/;

  static createRealtimeProxy(manager: IPluginManagerInterface, pluginSlug: string): IPluginContextRealtime {
    const tokens = new RealtimeRoomTokens(manager);
    const roomOf = (name: string): string => `${pluginSlug}:${String(name ?? '').trim()}`;

    return {
      roomToken: (name: string, options?: { ttlSeconds?: number }): Promise<string> =>
        tokens.mint(roomOf(name), options?.ttlSeconds),

      emit: async (name: string, type: string, payload?: unknown): Promise<void> => {
        const room = roomOf(name);
        if (!RealtimeRoomTokens.ROOM_PATTERN.test(room)) throw new Error(`Not a realtime room name: "${name}"`);
        if (!RealtimeContextProxy.TYPE_PATTERN.test(String(type ?? ''))) throw new Error(`Not a realtime event type: "${type}"`);
        const sites = TenantMode.isEnabled();
        const tenantId = sites ? String(RequestContextUtils.getTenantId() ?? '').trim() || null : null;
        if (sites && !tenantId) throw new Error('A realtime room belongs to a site; this code is not running for one');
        const data = JSON.stringify({ type, payload: payload ?? null, plugin: pluginSlug });
        if (Buffer.byteLength(data) > RealtimeContextProxy.MAX_EVENT_BYTES) throw new Error(`A realtime event is limited to ${RealtimeContextProxy.MAX_EVENT_BYTES} bytes`);
        ProcessSignals.announce(ProcessSignal.REALTIME_ROOM, { tenantId, room, data });
      },
    };
  }
}
