# Site visibility and preview

A site is not open to the public until somebody says it is. This page covers what each visibility
setting does, how the people building a site see it before launch, and why that needed a mechanism
rather than a permission check.

---

## The three settings

Visibility lives on the site itself — **Sites → (a site) → Overview → Visible to** — and it is a
different question from **State**. Suspending a site takes its admin away too; visibility only
decides who may *read* it.

| Setting | Anonymous visitor | Search engines | The site's own admins |
|---|---|---|---|
| **Nobody yet — only this site's admins** (`private`) | A holding page, `503` | Not indexed | The real site |
| **Anyone with the address — not indexed** (`unlisted`) | The real site | Not indexed | The real site |
| **Everyone — indexed** (`public`) | The real site | Indexed | The real site |

New sites are created **private**. Sites that existed before this setting was introduced were set to
`public` explicitly by the migration that added it — an upgrade that silently took live sites dark
would be the worst possible way to ship a safety feature.

A **suspended** site outranks all of this and is refused to everyone, its admins included.

### What a closed site answers

`503`, not `404`, with `Retry-After` and `X-Robots-Tag: noindex, nofollow`. The site exists and will
be there later; a `404` tells a crawler the address is wrong. The answer is never cached
(`Cache-Control: no-store`), because it changes the moment somebody presses Publish.

A handful of routes keep answering on a closed site, because without them it cannot be built at all:
the frontend config, i18n, health, theme and plugin assets, the auth routes (you have to be able to
log in before you can be recognised), and the preview exchange described below.

---

## Previewing a site before it is published

On a private site the header button on **Sites → (a site)** reads **Preview** instead of **Visit**.
Pressing it opens the real storefront in a new tab, with a bar across the top:

> ● **Not published — only you can see this.** Visitors get a holding page.

The bar is framework-owned and renders above everything the theme produces, so it appears on every
theme including ones written before this existed, and no theme can suppress it. It disappears the
moment the site is published — it is not a per-viewer preference, it is a statement about the site.

**Who may ask for a preview:** a platform admin, or an administrator *of that site*. Not "anyone
holding the `admin` role", which on a multi-site platform is every customer's own administrator.

**What a preview opens:** visibility, and nothing else. It is not an account and grants no role, and
it does not open draft content — drafts are gated separately, on a real session's permissions.

### Why it is a link and not a permission check

The admin console sets its session cookie **host-scoped**, on purpose: a shared cookie domain
produced a "Token tenant mismatch" bug and was fixed by narrowing it. So the console's session is
never presented on a site's own domain — and when a customer points their own apex domain at the
platform, there is no shared domain to widen it to even in principle. A cookie change cannot fix
this; a one-time token in a URL is the one thing that crosses.

So:

1. The admin asks the api for a **grant**: a random 256-bit token, stored only as a SHA-256 hash,
   bound to one site and one account, valid for **60 seconds** and spendable **once**.
2. The operator's browser follows the link to
   `https://<the site's host>/api/v1/system/site-preview/exchange/<token>`.
3. The api spends the grant — an UPDATE whose WHERE says "only if unspent", so two browsers
   following the same link race on the database rather than in the gap between a read and a write —
   and sets an **httpOnly, host-scoped** `fc_site_preview` cookie valid for **two hours**.
4. Every later request presents that cookie; the api verifies it against the table and against
   *this* site on each one.

A failed exchange — expired, already spent, minted for a different site — redirects to `/` with no
cookie, so the holding page answers and the visitor is told nothing. The reason is written to the
server log instead, because the operator does need to know which it was.

### What was deliberately not built

A constant query parameter such as `?preview=1` that grants by itself. That was tried in this
codebase once and leaked drafts. A server-validated, single-use, tenant-bound secret is a different
thing, and the distinction is the whole design.

---

## For a reverse proxy or CDN in front of the platform

A private site's `/system/frontend` response carries `Cache-Control: no-store`, and so does the
holding page. Do not cache either. The verdict is **per visitor**, not per host: one cached "open"
answer served to an anonymous visitor would publish an unfinished site, and one cached "closed"
answer served to an operator would lock them out of their own.

The storefront applies the same rule internally — it keys its short-lived verdict cache on the host
*plus* a fingerprint of the preview cookie, so an operator's answer is never handed to a stranger.

---

## Where the pieces live

| Concern | Where |
|---|---|
| The setting and its three values | `TenantVisibility` (`packages/core/src/enums/tenant-visibility.enum.ts`) |
| Whether a request may read a closed site | `SiteVisibilityGate`, mounted by `SiteVisibilityMiddleware` (`packages/api/src/server/`) |
| Minting, spending and verifying a preview | `SitePreviewGrantService` (`packages/core/src/tenant/preview/`) |
| The two endpoints | `SitePreviewRouter` (`packages/api/src/routes/site-preview-router.ts`) |
| The holding page and the per-visitor verdict | `SiteVisibilityProxyGuard` (`packages/frontend/lib/document/`) |
| The banner | `SitePreviewBannerView` + `site-preview-banner.css` (`packages/frontend/lib/document/`) |

Grants are swept hourly; nothing accumulates. The table stores hashes only, so a copy of the
database is not a set of working preview links.
