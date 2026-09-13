# Certificates and TLS

How the platform serves HTTPS for the addresses it answers on, and what an operator has to do about it.

---

## The problem this solves

The platform has always known which hosts it serves. It knew nothing about how those hosts were
served over HTTPS: certificates lived in whatever proxy happened to sit in front, configured by hand,
one block per domain. Two consequences followed.

**Every new customer domain was a manual edit on a server.** Forget it, or get it wrong, and the site
is broken in a way nothing in the product reports. This actually happened: hand-written router entries
pointed two workspace hosts at the storefront, so those hosts served a site's holding page instead of
the admin console, and nothing anywhere said so.

**An operator who had BOUGHT a certificate had nowhere to put it.** Extended-validation certificates,
wildcards bought for use elsewhere, certificates a customer's compliance rules require from a named
issuer — the platform had no answer for any of them.

---

## The two ways a host gets a certificate

An operator chooses per host. Both are first-class; neither is a fallback for the other.

| Source | Who obtains it | Who renews it |
|---|---|---|
| **Uploaded** | The operator pastes the certificate and its key | **Nobody.** The platform warns; a human replaces it |
| **Automatic** | The platform | The platform | 

> **Automatic is declared but NOT IMPLEMENTED yet.** The value exists in the data model so that
> nothing has to change when issuance lands, and the admin says so rather than offering a control
> that does nothing. Until then, every certificate is an uploaded one.

### The platform never silently replaces a certificate it was given

An expired **uploaded** certificate is served expired, and shouted about. It is not quietly swapped
for a free one.

That is deliberate. An operator who bought a certificate did so for a reason, and replacing it behind
their back would undo that decision without anyone seeing it happen. The platform renews what it
issued and never touches what it was handed.

---

## Where certificates and private keys live

One row per exact host, in `_system_certificates`.

- **The certificate chain is stored in the clear.** It is handed to every visitor who opens the site;
  encrypting it would protect nothing and only make it unreadable when something goes wrong.
- **The private key is encrypted at rest** with `SecretService` (AES-256-GCM), keyed from `SECRET_KEY`
  (or the older `INTEGRATION_SECRET_KEY`) — the same mechanism that already protects integration
  credentials. No new key, no second mechanism.
- **With no key configured, the platform refuses to accept a private key at all**, and the admin
  disables the upload control and says why. Failing after somebody has pasted a key is both worse and
  later.

The table is **platform-level and never tenant-scoped**. Whatever terminates TLS loads every host's
certificate at once, before any request exists and therefore before there is a tenant to scope to.
`tenant_id` on the row is a reference for display and cascade only.

### The key can leave the store in exactly one place

`CertificateRecord` has two projections, named differently on purpose:

- `toAdminJson()` — has no private key field to return. Everything the admin sees comes from this.
- `toEdgeJson()` — includes the decrypted key. Reached only by the internal endpoint below.

"Which code paths can leak a key" is therefore a grep for one method name, not a reading of every route.

---

## Exactly what an operator does

1. Add the domain to the site in the admin (Sites → the site → **Overview**, primary host or aliases).
2. Point the customer's DNS at the platform.
3. Go to **Certificates** (or the site's **Domains** tab), press **Upload**, and paste the certificate
   chain and the private key.

That is the whole flow. The certificate is live as soon as it is stored.

### When an upload is refused

Every refusal names the one thing that is wrong, because "invalid certificate" sends somebody back to
their issuer to re-download both files when only one of them is the problem.

| What the admin says | What it means |
|---|---|
| Not a readable certificate | The certificate box does not contain PEM text |
| Not a readable private key | Usually a passphrase-protected key — unusable, since the platform would have to hold the passphrase too |
| The key does not match the certificate | Almost always a key from a different order |
| Already expired | Storing it would put a broken certificate live |
| Not issued for this host | Valid, but for other names — browsers would reject it |

The **earliest** problem is reported, not a cascade. Validation runs **before anything is written**, so
a refused upload leaves whatever was already serving completely untouched.

---

## Expiry warnings

**The platform sends these itself, because nobody else does any more.**

Let's Encrypt [ended its expiration notification emails on 4 June 2025](https://letsencrypt.org/2025/06/26/expiration-notification-service-has-ended),
citing privacy and cost. So for an automatically issued certificate nobody external is watching — and
for an uploaded one nobody ever was: no issuer knows where a certificate was installed, and nothing
here renews it.

A daily sweep warns at **30, 14, 7 and 1 days**, and once more on expiry. A threshold already sent is
never sent again, so a month produces four emails rather than thirty.

**Recipients are the PLATFORM's admins, not the site's.** That is deliberate: uploading a certificate
is platform-admin-only, so a site's own administrator cannot act on the warning even if they got it.
Telling somebody about an emergency they have no way to fix is noise, and noise is how real alerts get
ignored.

> The warning thresholds are not operator-configurable yet. The admin states the schedule so it is at
> least visible; making it a declared setting belongs with the other certificate settings.

---

## What actually serves the certificates

Two arrangements. The admin reads the answer from the gateway's own health endpoint and **states it
plainly**, because an operator who uploads a certificate, sees a green badge, and finds the site still
broken has been lied to by this product.

### A. Something else terminates TLS (the default)

Whatever is in front of the platform holds the certificates it serves. Stored certificates sit in the
table unused, and the Certificates page says exactly that.

### B. The platform's own gateway terminates TLS (opt-in)

Set `GATEWAY_TLS_PORT` and the gateway additionally listens for HTTPS, answering each handshake with
the certificate stored for the name the client asked for.

- **There is no default certificate.** A name with nothing stored — and a client sending no name at
  all — is refused at the handshake. Answering with some other host's certificate, or a self-signed
  one, would replace a clean connection failure with a browser security warning and teach operators to
  click through those warnings.
- Plain HTTP then becomes a signpost: everything is redirected to HTTPS, except the health and reload
  paths, which are internal calls on the container network.
- **Unset, nothing changes.** The gateway behaves exactly as it did before.

An operator who already runs an edge keeps it: forward TCP to the gateway's TLS port and port 80 to
its plain listener. No per-domain configuration on that edge, ever.

---

## The edge contract

The framework states facts about hosts. It never renders anybody's proxy configuration, and no proxy
vendor is named anywhere in `packages/**` — the same rule that stops the framework naming a theme's UI
library. An edge can be anything: it consumes the facts in its own way.

| Endpoint | Answers | Auth |
|---|---|---|
| `GET /internal/hosts/permit?host=` | Is this host one of ours? `200` yes · `404` not ours · `403` ours but suspended | Internal secret, **or** a caller on a private address |
| `GET /internal/routing` | The full host → app map | Internal secret |
| `GET /internal/certificates` | Certificates **and private keys** | Internal secret **only** |

**Ask-class edges** (Caddy and anything else supporting on-demand TLS) ask `permit` at handshake time
and need nothing else — a customer domain requires no configuration at all. **Tell-class edges**
(Traefik, nginx) cannot ask during a handshake, so they read the routing list and reload.

`permit` accepts a private-address caller because a proxy asking during a TLS handshake cannot attach
custom headers. **`/internal/certificates` does not** — a caller that cannot send the header has no
business with a private key.

### Three rules that are not negotiable

1. **None of these may be published through the edge.** `permit` reachable from the internet is a
   host-enumeration oracle. `/internal/certificates` reachable from the internet is the private keys
   of every site on the platform.
2. **Certificates are never cached.** A cached key outlives the removal of a certificate, and revoking
   something a cache still holds is not revoking it.
3. **No secret configured → the routes answer nothing at all**, so a deployment that never set one
   exposes nothing rather than everything.

---

## Reference

**Admin** — Certificates (account menu) for every host on the platform, ordered soonest-to-expire
first; a site's **Domains** tab for just that site's hosts.

**States.** `No certificate` · `Valid` · `Expiring` (uploaded, running out, nothing will renew it) ·
`Renewal due` (platform-managed, running out) · `Expired` · `Failed`. Plus `Waiting for DNS` and
`Issuing`, which only the automatic path can reach.

Expiry states are **derived from the certificate's own dates at read time**, never stored. A stored
"serving" becomes a lie the moment a certificate lapses and no sweep has run yet.

**Environment**

| Variable | Effect |
|---|---|
| `SECRET_KEY` | Encrypts private keys at rest. Without it, uploading is disabled |
| `INTERNAL_SERVICE_SECRET` | Gates every internal endpoint. Without it they answer nothing |
| `GATEWAY_TLS_PORT` | Opt in to the gateway terminating TLS. Unset = unchanged behaviour |
| `GATEWAY_CERTIFICATES_TTL_MS` | How often the gateway refreshes its copy (default 60s) |

**Not built yet:** automatic issuance (ACME), DNS pre-checks, renewal of platform-issued certificates,
HTTP/2 on the gateway's TLS listener, OCSP stapling, and operator-configurable warning thresholds.
