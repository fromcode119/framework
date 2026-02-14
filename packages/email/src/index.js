"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailManager = exports.EmailFactory = void 0;
class EmailFactory {
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
            throw new Error(`Email driver "${name}" not found.`);
        }
        return creator(config);
    }
    static registerDefaults() {
        this.register('smtp', (config) => {
            const { SMTPDriver } = require('./drivers/smtp');
            return new SMTPDriver(config);
        });
        this.register('mock', () => {
            const { MockEmailDriver } = require('./drivers/mock');
            return new MockEmailDriver();
        });
    }
}
exports.EmailFactory = EmailFactory;
class EmailManager {
    driver;
    constructor(driver) {
        this.driver = driver;
    }
    async send(options) {
        return this.driver.send(options);
    }
}
exports.EmailManager = EmailManager;
//# sourceMappingURL=index.js.map