import type Redis from 'ioredis';
import { HookMessagingAdapter } from '../types';

/**
 * Redis adapter: Distributes hooks across instances via Pub/Sub
 */
export class RedisHookAdapter implements HookMessagingAdapter {
  private pub: Redis;
  private sub: Redis;
  private channel: string;

  constructor(redisUrl: string, namespace?: string) {
    const RedisClass = require('ioredis');
    this.pub = new RedisClass(redisUrl);
    this.sub = new RedisClass(redisUrl);
    this.channel = `${namespace || 'fromcode'}:events`;
  }

  async publish(event: string, payload: any): Promise<void> {
    await this.pub.publish(this.channel, JSON.stringify({ event, payload }));
  }

  async subscribe(callback: (event: string, payload: any) => void): Promise<void> {
    await this.sub.subscribe(this.channel);
    this.sub.on('message', (channel, message) => {
      if (channel === this.channel) {
        try {
          const { event, payload } = JSON.parse(message);
          callback(event, payload);
        } catch (e) {
          console.error('[RedisHookAdapter] Failed to parse event', e);
        }
      }
    });
  }
}