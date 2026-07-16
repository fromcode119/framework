export class AppEnv {
	static readonly COMPANY_NAME = 'Fromcode';
	static readonly APP_NAME = 'Atlantis';
	static readonly PRODUCT_NAME = 'Fromcode Atlantis';
	static readonly AI_NAME = 'Atlantis Intelligence';
	static readonly AI_ENABLED = process.env.NEXT_PUBLIC_ADMIN_AI_ENABLED !== 'false';
	static readonly APP_VERSION = '0.1.31';
	static readonly APP_CHANNEL = 'Alpha';
	static readonly APP_CODENAME = 'Fromcode Core';
	/** Per-deployment default admin appearance id. Empty string = use the built-in default. */
	static readonly ADMIN_APPEARANCE = process.env.NEXT_PUBLIC_ADMIN_APPEARANCE ?? '';
	/**
	 * Per-deployment PWA/install identity. The framework ships its own brand mark + palette as the
	 * DEFAULTS, so an unconfigured deployment behaves exactly as before; a platform overrides these via
	 * env instead of patching framework source. Icon path is admin-root-relative (resolved through
	 * AdminPathUtils by the consumer), colors are any CSS color the manifest spec accepts.
	 */
	/**
	 * Per-deployment brand imagery for the admin shell (sidebar mark + login logo). The framework ships its
	 * own brand assets as the DEFAULTS, so an unconfigured deployment renders exactly as before; a platform
	 * rebrands the console via env instead of patching framework source. Paths are admin-root-relative
	 * (resolved through AdminPathUtils by the consumer), so a deployment can point at any asset it serves
	 * from the admin `public/` root. The login logo is split light/dark because the shell swaps the two by
	 * colour scheme — a deployment with a single logo simply points both at the same file.
	 */
	static readonly DEFAULT_BRAND_MARK_PATH = '/brand/atlantis-mark-indigo.png';
	static readonly DEFAULT_BRAND_LOGO_LIGHT_PATH = '/brand/atlantis-logo-slate.png';
	static readonly DEFAULT_BRAND_LOGO_DARK_PATH = '/brand/atlantis-logo-white.png';
	static readonly BRAND_MARK_PATH = process.env.NEXT_PUBLIC_ADMIN_BRAND_MARK || AppEnv.DEFAULT_BRAND_MARK_PATH;
	static readonly BRAND_LOGO_LIGHT_PATH =
		process.env.NEXT_PUBLIC_ADMIN_BRAND_LOGO_LIGHT || AppEnv.DEFAULT_BRAND_LOGO_LIGHT_PATH;
	static readonly BRAND_LOGO_DARK_PATH =
		process.env.NEXT_PUBLIC_ADMIN_BRAND_LOGO_DARK || AppEnv.DEFAULT_BRAND_LOGO_DARK_PATH;
	/**
	 * PWA icon default deliberately stays its OWN constant rather than chaining onto BRAND_MARK_PATH: the
	 * manifest declares fixed 192/512 PNG sizes, so an arbitrary brand mark is not automatically a valid
	 * install icon. It carries the same default asset and remains independently env-overridable.
	 */
	static readonly DEFAULT_PWA_ICON_PATH = AppEnv.DEFAULT_BRAND_MARK_PATH;
	static readonly DEFAULT_PWA_BACKGROUND_COLOR = '#020617';
	static readonly DEFAULT_PWA_THEME_COLOR = '#4f46e5';
	static readonly PWA_ICON_PATH = process.env.NEXT_PUBLIC_ADMIN_PWA_ICON || AppEnv.DEFAULT_PWA_ICON_PATH;
	static readonly PWA_BACKGROUND_COLOR =
		process.env.NEXT_PUBLIC_ADMIN_PWA_BACKGROUND_COLOR || AppEnv.DEFAULT_PWA_BACKGROUND_COLOR;
	static readonly PWA_THEME_COLOR =
		process.env.NEXT_PUBLIC_ADMIN_PWA_THEME_COLOR || AppEnv.DEFAULT_PWA_THEME_COLOR;
}
