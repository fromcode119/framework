import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { SocketMessagePort } from '@core/process/socket-message-port';
import { PluginHostProtocol } from '@core/plugin/host/protocol/plugin-host-protocol';
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
  ) {}

  static async attach(controlSocket: string, secret: string, timeoutMs: number): Promise<PluginGuestAttachment> {
    const channel = new PluginChannel(await SocketMessagePort.connect(controlSocket, timeoutMs));
    try {
      const hello = await channel.request<Record<string, any>>('hello', { secret }, timeoutMs);
      const refusal = PluginHostProtocol.refusal(hello.protocol);
      if (refusal) throw new Error(`plugin process refused: ${refusal}`);
      return new PluginGuestAttachment(channel, String(hello.connectionId), Number(hello.pid), hello.described, hello.registrations ?? [], hello.protocol);
    } catch (error) {
      channel.close();
      throw error;
    }
  }
}
