import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { SocketMessagePort } from '@core/process/socket-message-port';
import { PluginHostProtocol } from '@core/plugin/host/protocol/plugin-host-protocol';
import { PluginChannelMessage } from '@core/plugin/host/enums/plugin-channel-message.enum';
import type { IPluginProtocolIdentity } from '@core/plugin/host/protocol/interfaces/plugin-protocol-identity.interface';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';

/**
 * An api connecting to a plugin process it did NOT start — the api side of `PluginGuestConnections`.
 *
 * Says `hello` with the process's attach secret and learns what it needs to take the process over:
 * the protocol it speaks (a mismatch is refused, as at boot), what it answered at boot, and everything
 * it has registered. Calls the process makes back arrive on this channel, so the attaching api serves
 * them like the api that started it does.
 */
export class PluginGuestAttachment {
  constructor(
    readonly channel: PluginChannel,
    readonly connectionId: string,
    readonly pid: number,
    readonly described: { contractKeys: string[]; publicApiKeys: string[]; manifest: unknown },
    readonly registrations: IPluginGuestRegistration[],
    readonly protocol: IPluginProtocolIdentity,
    /** The socket under `channel`. */
    readonly port: SocketMessagePort,
    /** Whether the process finished starting (its `onEnable` ran) — one whose api died mid-start did not. */
    readonly enabled: boolean,
  ) {}

  static async attach(controlSocket: string, secret: string, timeoutMs: number): Promise<PluginGuestAttachment> {
    const port = await SocketMessagePort.connect(controlSocket, timeoutMs);
    const channel = new PluginChannel(port);
    try {
      const hello = await channel.request<Record<string, any>>(String(PluginChannelMessage.HELLO.value), { secret }, timeoutMs);
      const refusal = PluginHostProtocol.refusal(hello.protocol);
      if (refusal) throw new Error(`plugin process refused: ${refusal}`);
      return new PluginGuestAttachment(channel, String(hello.connectionId), Number(hello.pid), hello.described, hello.registrations ?? [], hello.protocol, port, hello.enabled === true);
    } catch (error) {
      channel.close();
      throw error;
    }
  }
}
