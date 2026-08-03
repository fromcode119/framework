import type { ICacheDriver } from '@cache/interfaces/cache-driver.interface';

/** Factory that builds a CacheDriver from config (callable contract — was a `type` alias). */
export interface ICacheDriverCreator {
  (config: any): ICacheDriver;
}
