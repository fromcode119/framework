export class AppEnv {
	static readonly COMPANY_NAME = 'Fromcode';
	static readonly APP_NAME = 'Atlantis';
	static readonly PRODUCT_NAME = 'Fromcode Atlantis';
	static readonly AI_NAME = 'Atlantis Intelligence';
	static readonly AI_ENABLED = process.env.NEXT_PUBLIC_ADMIN_AI_ENABLED !== 'false';
	static readonly APP_VERSION = '0.1.31';
	static readonly APP_CHANNEL = 'Alpha';
	static readonly APP_CODENAME = 'Fromcode Core';
}
