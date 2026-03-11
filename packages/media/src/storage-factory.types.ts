/** Type definitions for StorageFactory */

import type { StorageDriver } from './storage-factory.interfaces';

export type StorageDriverCreator = (config: any) => StorageDriver;
