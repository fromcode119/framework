/**
 * Where uploaded files live and the environment variables that move them. Reached as
 * `SystemConstants.STORAGE.*` exactly as before; split out so browser code that only needs the public
 * uploads path does not import every system constant.
 */
export class StorageConstants {
  static readonly ALL = {
    UPLOAD_DIR_ENV: 'STORAGE_UPLOAD_DIR',
    PUBLIC_URL_ENV: 'STORAGE_PUBLIC_URL',
    DEFAULT_UPLOADS_SUBDIR: 'public/uploads',
    /** Per-tenant file subdirectory under the uploads root. Single-tenant installs never use it. */
    TENANTS_SUBDIR: 'tenants',
    DEFAULT_PUBLIC_URL: '/uploads',
    /**
     * Where PRIVATE files live. The default deliberately sits OUTSIDE `public/`: the uploads dir is
     * handed to `express.static` twice, and those mounts are registered before cookies, CSRF, auth and
     * the rate limiter — so anything reachable from them is anonymous and unthrottled by construction.
     * A private file under that tree would be public no matter what guards its route carries.
     */
    PRIVATE_DIR_ENV: 'STORAGE_PRIVATE_DIR',
    DEFAULT_PRIVATE_SUBDIR: 'storage/private'
  } as const;
}
