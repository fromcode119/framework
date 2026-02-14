export interface EmailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    from?: string;
}
export interface EmailDriver {
    send(options: EmailOptions): Promise<any>;
}
export type EmailDriverCreator = (config: any) => EmailDriver;
export declare class EmailFactory {
    private static drivers;
    static register(name: string, creator: EmailDriverCreator): void;
    static create(name: string, config: any): EmailDriver;
    private static registerDefaults;
}
export declare class EmailManager {
    private driver;
    constructor(driver: EmailDriver);
    send(options: EmailOptions): Promise<any>;
}
