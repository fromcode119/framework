import type Redis from 'ioredis';
import type { IProcessSignalTransport } from '@core/signals/interfaces/process-signal-transport.interface';

/** Process signals over Redis pub/sub: one connection publishes, one listens (a subscribed connection can do nothing else). */
export class RedisProcessSignalTransport implements IProcessSignalTransport {
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly channel: string;

  constructor(redisUrl: string, namespace = 'fromcode') {
    const RedisClass = require('ioredis');
    this.pub = new RedisClass(redisUrl);
    this.sub = new RedisClass(redisUrl);
    this.channel = `${namespace}:process-signals`;
    // A dropped connection is logged by the caller's publish failure or retried by ioredis; an
    // 'error' with no listener is printed as unhandled and says nothing about which connection it was.
    for (const [role, client] of [['publish', this.pub], ['subscribe', this.sub]] as const) {
      client.on('error', (error: Error) => console.warn(`[process-signals] Redis ${role} connection: ${error.message}`));
    }
  }

  async publish(message: string): Promise<void> {
    await this.pub.publish(this.channel, message);
  }

  async subscribe(onMessage: (message: string) => void): Promise<void> {
    this.sub.on('message', (channel: string, message: string) => {
      if (channel === this.channel) onMessage(message);
    });
    // SUBSCRIBE only once the connection is READY: sent earlier, it could reach Redis before ioredis's own
    // ready check (INFO), which a subscribed connection then refuses ("Connection in subscriber mode").
    if (this.sub.status !== 'ready') await new Promise<void>((resolve) => this.sub.once('ready', () => resolve()));
    await this.sub.subscribe(this.channel);
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.sub.quit(), this.pub.quit()]);
  }
}
