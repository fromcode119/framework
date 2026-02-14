"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaManager = exports.StorageFactory = void 0;
const path_1 = __importDefault(require("path"));
const sharp_1 = __importDefault(require("sharp"));
__exportStar(require("./media-service"), exports);
__exportStar(require("./media-collection"), exports);
class StorageFactory {
    static drivers = new Map();
    static register(name, creator) {
        this.drivers.set(name, creator);
    }
    static create(name, config) {
        // Register defaults on first use
        if (this.drivers.size === 0) {
            this.registerDefaults();
        }
        const creator = this.drivers.get(name);
        if (!creator) {
            throw new Error(`Storage driver "${name}" not found. Available: ${Array.from(this.drivers.keys()).join(', ')}`);
        }
        return creator(config);
    }
    static registerDefaults() {
        this.register('local', (config) => {
            const { LocalStorageDriver } = require('./drivers/local-driver');
            return new LocalStorageDriver(config.uploadDir, config.publicUrlBase);
        });
        this.register('s3', (config) => {
            const { S3StorageDriver } = require('./drivers/s3-driver');
            return new S3StorageDriver({ ...config, provider: 's3' });
        });
        this.register('r2', (config) => {
            const { S3StorageDriver } = require('./drivers/s3-driver');
            return new S3StorageDriver({ ...config, provider: 'r2' });
        });
    }
}
exports.StorageFactory = StorageFactory;
class MediaManager {
    driver;
    constructor(driver) {
        this.driver = driver;
    }
    get provider() { return this.driver.provider; }
    async upload(file, filename) {
        const ext = path_1.default.extname(filename).toLowerCase();
        const mimeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf',
            '.mp4': 'video/mp4'
        };
        const mimeType = mimeMap[ext] || 'application/octet-stream';
        let width;
        let height;
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            const metadata = await (0, sharp_1.default)(file).metadata();
            width = metadata.width;
            height = metadata.height;
        }
        const filePath = await this.driver.save(file, filename);
        return {
            url: this.driver.getUrl(filePath),
            path: filePath,
            width,
            height,
            size: file.length,
            mimeType,
            provider: this.driver.provider
        };
    }
    async remove(filepath) {
        await this.driver.delete(filepath);
    }
}
exports.MediaManager = MediaManager;
//# sourceMappingURL=index.js.map