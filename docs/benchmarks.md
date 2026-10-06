# Benchmarks — Atlantis against the platforms people actually run

**req/s** = requests per second (higher is better), measured on **6 October 2026** on one 2 vCPU / 4 GB server, one platform
at a time, on the same data. Nine platforms: Atlantis (the framework in this repository with the shop and
CMS plugins), Payload, Directus, Strapi, Medusa, PrestaShop, Magento 2.4, Drupal 11 + Commerce 3 and
WordPress + WooCommerce. Best result in each row in **bold**.

> These are the numbers from one server and one dataset, run by us. Read [How it was measured](#how-it-was-measured)
> and [What this does not show](#what-this-does-not-show) before quoting them, and run the same load on your
> own hardware before choosing a platform.

## How to read the numbers

Every number is **req/s — requests per second**: how many requests the server answers each second. A request is
one thing a website or app asks for, such as "show me 20 products" or "show me this one product". **Higher is
faster**: 200 req/s means one small server can answer about 200 people asking at the same moment, and 10 req/s
means it starts queueing at about 10. "3×" means three times as many requests answered per second on the same
hardware.

## 1. Every platform, every operation (req/s)

| Operation (req/s) | Fromcode — plain record | Fromcode — full shop / CMS record | Payload | Directus | Strapi | Medusa | PrestaShop | Magento 2.4 | Drupal 11 + Commerce | WordPress + WooCommerce |
|:--|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Product list, storefront card (20) | — | **166.0** <sub>(no equivalent elsewhere)</sub> | — | — | — | — | — | — | — | — |
| List of 20 records | **203.4** | 92.2 <sub>(computed per request 48.5)</sub> | 137.5 | 109.6 | 99.5 | 13.7 | 14.7 | 9.8 | 9.3 | 6.2 |
| Single record / product | **255.9** | 214.6 <sub>(computed per request 107.0)</sub> | 217.6 | 128.8 | 115.2 | 25.6 | 54.1 | 12.8 | 12.4 | 21.0 |
| Page by slug | **255.9** <sub>(same operation as a single record)</sub> | 213.9 | 221.8 | 134.2 | 113.0 | — | 71.2 | 21.3 | 13.1 | 14.8 |
| Posts list (20) | **203.4** <sub>(same operation as a list)</sub> | 124.2 | 147.3 | 101.9 | 101.9 | — | — | — | 9.6 | 7.9 |
| Filtered + sorted (20) | **150.4** | 66.8 <sub>(card view 128.4)</sub> | 130.8 | 101.1 | 68.8 | 16.2 | 14.9 | 10.3 | 8.9 | 10.7 |
| Signed-in read (20) | **157.4** | 119.0 | 76.5 | 103.1 | 94.6 | 10.5 | 51.7 | 6.4 | 4.3 | 7.7 |
| Create a record | **84.7** | 70.3 | 58.9 | 76.5 | 76.2 | 5.2 | 23.0 | 24.1 | 4.3 | 14.7 |

The first Atlantis column is a plain collection with the same six fields as the other tools' products
(`name`, `slug`, `description`, `price`, `sku`, `stock`), through Atlantis' generic REST API. The second is
Atlantis' own **full shop product** (94 columns, tax-aware prices, variants, stock, ratings, lead time) and
CMS records, which carry several times the data of a plain record. The second column is the like-for-like for
the commerce platforms (Medusa, PrestaShop, Magento, Drupal Commerce, WooCommerce), which also return full
commerce products. Atlantis is first in every row.

## 2. The full shop product against the commerce platforms (req/s)

| Operation (req/s) | Fromcode, full shop / CMS record | Best of the five commerce platforms | Which | Fromcode ahead by |
|:--|--:|--:|:--|--:|
| Product list, full (20) | **92.2** | 14.7 | PrestaShop | 6.3× |
| Single product | **214.6** | 54.1 | PrestaShop | 4.0× |
| Page by slug | **213.9** | 71.2 | PrestaShop | 3.0× |
| Posts list (20) | **124.2** | 9.6 | Drupal | 12.9× |
| Filtered + sorted (20) | **66.8** | 16.2 | Medusa | 4.1× |
| Signed-in read (20) | **119.0** | 51.7 | PrestaShop | 2.3× |
| Create a record | **70.3** | 24.1 | Magento | 2.9× |

The shop's product list and single product are answered from a page the shop prepares beforehand and empties
the moment anything it depends on changes. Worked out on every request they are 48.5 and 107.0 requests per
second, which is still ahead of every commerce platform in those rows (14.7 and 54.1 at best).

## 3. Plain records, 6 fields — against the other open-source backends (req/s)

| Operation (req/s) | Fromcode | Payload | Directus | Strapi |
|:--|--:|--:|--:|--:|
| List of 20 records | **203.4** | 137.5 | 109.6 | 99.5 |
| One record by slug | **255.9** | 217.6 | 128.8 | 115.2 |
| Filtered + sorted (20) | **150.4** | 130.8 | 101.1 | 68.8 |
| Signed-in read (20) | **157.4** | 76.5 | 103.1 | 94.6 |
| Create a record | **84.7** | 58.9 | 76.5 | 76.2 |

Payload (draft versions on), Directus and Strapi: Postgres, production mode, public read, the same six fields
and 1,000 rows as the Atlantis test collection.

## 4. Plain records, 36 fields — 30 more fields, same data (req/s)

| Operation (req/s) | Fromcode | Payload | Directus | Strapi |
|:--|--:|--:|--:|--:|
| List of 20 records | **147.7** | 72.2 | 80.8 | 75.1 |
| One record by slug | **221.9** | 142.0 | 111.8 | 110.1 |
| Filtered + sorted (20) | **95.8** | 64.2 | 84.8 | 57.9 |
| Signed-in read (20) | **116.7** | 65.2 | 77.4 | 73.2 |
| Create a record | **83.2** | 43.5 | 66.8 | 56.3 |

The 30 extra fields (10 text, 8 numbers, 6 switches, 4 dates, 2 JSON) are filled identically on all four
platforms, each rebuilt with the same fields and data. For Atlantis, 30 more fields cost 25% more CPU per list
request (5.2 → 6.5 ms) while the answer grows 2.4× (14.2 → 34.6 KB): about 2.2 µs per extra value.

## How it was measured

- **One server:** 2 vCPU, 4 GB RAM. The platform under test is pinned to core 0, the load generator
  ([oha](https://github.com/hatoo/oha), 32 connections) to core 1; every other stack is stopped.
- **Reads:** a warm-up, then the median of three 15-second runs. **Create:** 15 seconds of POSTs with a unique
  slug each, median of three.
- **Data:** 1,000 products (price, stock 100, a 520-character description), 3,625 posts where the platform has
  posts, 20 pages, one administrator.
- **No caches:** a unique query parameter on every request defeats full-page and response caches (Strapi,
  Medusa and PrestaShop reject unknown parameters and have no response cache, so they ran on the plain URL).
- **Each platform through its own public API:** Atlantis REST, Payload REST, Directus and Strapi REST, Medusa
  store API, PrestaShop webservice (JSON), Magento storefront GraphQL (admin REST for create), Drupal JSON:API,
  WooCommerce Store API + WordPress REST.
- **Dates:** Magento (Mage-OS 2.4 with MariaDB and OpenSearch), Drupal 11 + Commerce 3, WordPress +
  WooCommerce and Payload (6 fields) were measured on 4 October 2026; everything else on 5–6 October, on the
  same server and data.
- **Noise:** about ±10% from run to run. The narrowest leads (11% on 6-field create, 13% on 36-field filtered
  reads, 15% on 6-field filtered reads) are close to it.
- **Atlantis build:** framework 0.2.334–0.2.336 with the shop plugin 0.1.247–0.1.248 (the code released on 6
  October 2026), with the record-versions index (migration 62) applied.

## What this does not show

- Magento, Drupal, WordPress and PrestaShop have fixed commerce schemas, so they were measured at their own
  product width only; the width comparison is Atlantis, Payload, Directus and Strapi.
- Payload with Atlantis' full shop pricing logic was not built, so there is no like-for-like Payload number for
  the commerce product itself.
- Hosted SaaS (Shopify and similar) cannot be run on this server and is not included.
- A 2 vCPU / 4 GB server: Magento runs near its memory limit on it, and every platform would do better on a
  larger machine. The ranking is for this server and this data.
- The two plain-record collections measure the framework on two record widths, not a particular customer's data.
