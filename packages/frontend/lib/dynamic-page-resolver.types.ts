export type SearchParams = Record<string, string | string[] | undefined>;
export type MaybePromise<T> = T | Promise<T>;
export type LocaleStrategy = 'query' | 'path' | 'none';
export type ResolvedDocRecord = Record<string, unknown>;
export type ResolvedDocResult = {
	type: string;
	plugin: string;
	doc: ResolvedDocRecord | null;
};
