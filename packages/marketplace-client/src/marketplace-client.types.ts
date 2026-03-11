export type ScreenshotEntry = string | { url: string; caption?: string };

export type MarketplaceRating = { average: number; count: number };

export type MarketplaceChangelogEntry = { version: string; date: string; changes: string[] };

export type MarketplaceCoreInfo = { version: string; downloadUrl: string; lastUpdated: string };
