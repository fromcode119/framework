"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = exports.CacheFactory = void 0;
class CacheFactory {
    static drivers = new Map();
    static register(name, creator) {
        this.drivers.set(name, creator);
    }
    static create(name, config) {
        if (this.drivers.size === 0) {
            this.registerDefaults();
        }
        const creator = this.drivers.get(name);
        if (!creator) {
            throw new Error(`Cache driver "${name}" not found.`);
        }
        return creator(config);
    }
    static registerDefaults() {
        this.register('redis', (config) => {
            const { RedisCacheDriver } = require('./drivers/redis');
            return new RedisCacheDriver(config.url);
        });
        this.register('memory', () => {
            const { MemoryCacheDriver } = require('./drivers/memory');
            return new MemoryCacheDriver();
        });
    }
}
exports.CacheFactory = CacheFactory;
class CacheManager {
    driver;
    constructor(driver) {
        this.driver = driver;
    }
    async get(key) {
        const val = await this.driver.get(key);
        if (!val)
            return null;
        try {
            return JSON.parse(val);
        }
        catch {
            return val;
        }
    }
    async set(key, value, ttl) {
        const stringVal = typeof value === 'string' ? value : JSON.stringify(value);
        await this.driver.set(key, stringVal, ttl);
    }
    async del(key) {
        await this.driver.del(key);
    }
}
exports.CacheManager = CacheManager;
//# sourceMappingURL=index.js.map