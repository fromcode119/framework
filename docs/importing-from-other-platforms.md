# Importing From Other Platforms

The framework does not import anything itself. Moving a site from WordPress, WooCommerce, PrestaShop,
Magento, Drupal, Joomla, OpenCart, Ghost, Shopify, Wix, Payload or Strapi is a plugin's job. That
plugin reads the source platform and writes through the public API of the plugin that owns each kind
of data. The kernel provides the four primitives such a plugin cannot build on its own. This page
documents them.

## Records: `context.collections.create`

```ts
const product = await context.collections.create('products', { name: 'Blue shirt', slug: 'blue-shirt' });
```

`create` takes the same path an admin save takes: access policy, validation, the collection lifecycle
hooks (`beforeCreate`, `afterCreate`, …) and the first version snapshot. `context.db.insert` writes a raw
row and fires none of these. Search indexing, stock and permalinks rely on those hooks, so a raw insert
leaves records that look complete but are not.

`create`, like `update`, works on the calling plugin's **own** collections only. An importer never
writes another plugin's tables. It calls that plugin's namespace API (`context.plugins.namespace(…)`),
and the owning plugin creates the record with `context.collections.create`.

## Media: `context.media.ingest`

```ts
const media = await context.media.ingest({ filename: 'blue-shirt.jpg', sourceUrl: 'https://old-shop.example/wp-content/uploads/blue-shirt.jpg', alt: 'Blue shirt' });
// media.id, media.url
```

This is the same guarded store the MCP media tools use:

- Every redirect hop must resolve only to public addresses, so a URL cannot reach a private network
  or a metadata service.
- A URL carrying credentials is refused.
- The body is read under the 25 MB upload limit.
- The bytes are checked against the file type, and a WebP variant is made.
- Every file gets a fresh name.

Supply `base64` instead of `sourceUrl` for bytes you already hold. Calling `ingest` requires the
`content` capability.

## Old URLs: `context.redirects.ensure`

```ts
const result = await context.redirects.ensure([
  { fromPath: '/product/blue-shirt/', toPath: '/shop/blue-shirt' },
  { fromPath: '/2019/05/hello-world/', toPath: '/blog/hello-world' },
]);
// { created, skipped, failed: [{ fromPath, error }] }
```

`ensure` adds rules to the site's own redirect store (Settings → Redirects). That store is consulted
only for paths that would otherwise 404.

- **Add-only.** A path that already has a rule is skipped and never overwritten, so an operator's edit
  always wins and running an import twice adds nothing.
- **Defaults.** Rules are 301 unless `permanent: false`.
- **Limit.** At most 500 rules per call.
- **Query strings.** The store matches on the path alone, so a `fromPath` with a query string
  (`/?p=12`, `/index.php?id_product=3`) is reported in `failed` rather than collapsed onto the bare
  path. Map such URLs to their pretty path on the source side first.

Calling `ensure` requires the `content` capability.

## Passwords: store the old hash, the kernel does the rest

Pass the source platform's hash to `context.users.create({ email, password: <hash> })`, in one of the
shapes below. On that user's first successful sign-in the kernel verifies the old hash and replaces it
with its own bcrypt hash. The legacy hash is used once and is then gone.

The verifiers are a fixed set inside the kernel, not a hook. A plugin that could register a password
verifier could register one that accepts anything.

These hash formats are stored exactly as the source platform wrote them:

| Source | Stored as |
|:--|:--|
| WordPress < 6.8, phpBB, older Joomla | `$P$…` / `$H$…` (phpass) |
| WordPress 6.8+ | `$wp$2y$…` |
| Drupal 7 to 10.0 | `$S$…` (and `U$S$…` for hashes migrated from Drupal 6) |
| PrestaShop 1.7+, Joomla 3+, Drupal 10.1+, Ghost | `$2y$…` / `$2a$…` / `$2b$…` (plain bcrypt) |

Salted digests have no self-describing form. Write them as `$legacy$<scheme>$<salt as hex>$<digest as hex>`:

| Source | Scheme | Digest |
|:--|:--|:--|
| Magento 2 (`hash:salt:1`) | `sha256-prefix` | sha256(salt + password) |
| Magento 1 (`hash:salt`) | `md5-prefix` | md5(salt + password) |
| PrestaShop 1.6 | `md5-prefix`, with `_COOKIE_KEY_` as the salt | md5(key + password) |
| Plain unsalted md5 | `md5-prefix`, with an empty salt | md5(password) |
| Joomla 1.5–2.5 (`hash:salt`) | `md5-suffix` | md5(password + salt) |
| OpenCart 1.5–3 (`password` + `salt` columns) | `opencart-sha1` | sha1(salt + sha1(salt + sha1(password))) |

Some source accounts cannot keep their password. Import them without a usable password and send a
reset:

- **Argon2 hashes**: Magento 2.4 (`hash:salt:3_…`), and Joomla 4 when configured for Argon2. Node 22 has no Argon2.
- **Shopify, Wix and Squarespace**: these never export password hashes.
- **Any account whose hash you cannot read**, for example an API-only import. REST APIs do not return
  password hashes; only the source database has them.
