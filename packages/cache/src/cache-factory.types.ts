/** Type aliases for CacheFactory */
import type { CacheDriver } from './cache-factory.interfaces';

export type CacheDriverCreator = (config: any) => CacheDriver;
