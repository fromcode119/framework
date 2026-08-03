import type { IStorageDriver } from '@media/interfaces/storage-driver.interface';

/** Factory that builds a StorageDriver from config (callable contract — was a `type` alias). */
export interface IStorageDriverCreator {
  (config: any): IStorageDriver;
}
