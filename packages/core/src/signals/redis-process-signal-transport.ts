import type Redis from 'ioredis';
import type { IProcessSignalTransport } from '@core/signals/interfaces/process-signal-transport.interface';

/** Process signals over Redis pub/sub: one connection publishes, one listens (a subscribed connection can do nothing else). */
export class RedisProcessSignalTransport implements IProcessSignalTransport {
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly channel: string;

  constructor(redisUrl: string, namespace = 'fromcode') {
    const RedisClass = require('ioredis');
    this.pub = new RedisClass(redisUrl, { lazyConnect: false });
    this.sub = new RedisClass(redisUrl, { lazyConnect: false });
    this.channel = `${namespace}:process-signals`;
  }

  async publish(message: string): Promise<void> {
    await this.pub.publish(this.channel, message);
  }

  async subscribe(onMessage: (message: string) => void): Promise<void> {
    this.sub.on('message', (channel: string, message: string) => {
      if (channel === this.channel) onMessage(message);
    });
    await this.sub.subscribe(this.channel);
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.sub.quit(), this.pub.quit()]);
  }
}
