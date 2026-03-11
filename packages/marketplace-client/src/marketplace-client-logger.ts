export class MarketplaceClientLogger {
  static info(msg: string): void {
    console.info('[marketplace-client]', msg);
  }

  static error(msg: string): void {
    console.error('[marketplace-client]', msg);
  }
}
