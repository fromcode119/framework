import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Every message an api and a plugin process exchange on their channel.
 *
 * Carried as a VALUE on the wire (the channel serialises between two processes, and an Enum instance
 * does not survive that). The enum is where the list lives, so neither side can send or answer a
 * message the other has never heard of without failing to compile.
 */
export class PluginChannelMessage extends Enum {
  // api → plugin process
  static readonly BOOT = new PluginChannelMessage('boot');
  static readonly INVOKE = new PluginChannelMessage('invoke');
  static readonly PEERS = new PluginChannelMessage('peers');
  static readonly STOP = new PluginChannelMessage('stop');
  static readonly PING = new PluginChannelMessage('ping');
  static readonly RUNTIME = new PluginChannelMessage('runtime');
  /** An api attaching to a process it did not start (`PluginGuestConnections`). */
  static readonly HELLO = new PluginChannelMessage('hello');
  // plugin process → api
  static readonly CALL = new PluginChannelMessage('call');
  static readonly REGISTER = new PluginChannelMessage('register');
  static readonly LOG = new PluginChannelMessage('log');
}
