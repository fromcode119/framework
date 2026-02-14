export interface CacheDriver {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
}
export type CacheDriverCreator = (config: any) => CacheDriver;
export declare class CacheFactory {
    private static drivers;
    static register(name: string, creator: CacheDriverCreator): void;
    static create(name: string, config: any): CacheDriver;
    private static registerDefaults;
}
export declare class CacheManager {
    private driver;
    constructor(driver: CacheDriver);
    get<T = any>(key: string): Promise<T | null>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
}
