# Benchmark tools

The runner behind [docs/benchmarks.md](../../docs/benchmarks.md). It measures one system at a time, so you can run
the same load against Atlantis and anything else on your own hardware.

## What you need

- Docker, with the system under test running in a compose project that has its own network.
- The system's compose service **pinned to one CPU** (`cpuset: "0"`) when you want a single-core comparison; the
  load generator is pinned to CPU 1. A system that is not pinned can use both cores, which favours it.
- Data: 1,000 products with `name`, `slug`, `description` (about 520 characters), `price`, `sku` and `stock` (100),
  and a user that can read and create. The published results used exactly these six fields, and a second run with
  30 more fields (10 text, 8 numbers, 6 switches, 4 dates, 2 JSON) filled identically on every platform.

## Run it

```bash
# one JSON file per system; copy suite.example.json and change the URLs, headers and body
npx tsx tools/benchmark/suite.ts atlantis atlantis_default tools/benchmark/suite.atlantis.json
npx tsx tools/benchmark/suite.ts payload  payload_default  tools/benchmark/suite.payload.json
```

Each read: a 5 s warm-up, then the median of three 15 s runs at 32 connections. Create: 15 s of POSTs with a unique
slug each (`{n}` in the body), median of three. A URL starting with `re:` is a regular expression, so every request
gets a different query string (`u=[a-z0-9]{12}`) and no response cache can answer it. Some systems (Strapi, Medusa,
PrestaShop) reject unknown query parameters: give those the plain URL; they have no response cache.

## Read the results honestly

- Check `ok` is 100%: a row with failed requests measured error pages, not the system.
- Run-to-run noise is about ±10% on a 2 vCPU server; repeat before you believe a difference smaller than that.
- Create grows the table. Run the read rows first, and use `sort=id` (or restart from a fresh seed) before you look
  at a list again, or the newest rows are your own load-test rows.
- Compare a system at the same record width as the others. A full commerce product carries several times the data of
  a six-field record.
