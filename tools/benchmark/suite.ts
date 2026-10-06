/**
 * The benchmark suite for ONE system: every read test with oha (a warm-up, then the median of three 15 s runs at
 * 32 connections), and the create test with a Node load generator that sends a unique slug per request. The load
 * generator is pinned to CPU 1; pin the system under test to CPU 0 in its own compose file (`cpuset: "0"`).
 *
 *   npx tsx tools/benchmark/suite.ts <system-name> <docker-network> <suite.json>
 *
 * Needs Docker. Results are printed and written to `results/<system-name>.json`. See tools/benchmark/README.md.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

interface ISuite { headers?: string[]; auth?: string; reads: Record<string, string>; authedReads?: Record<string, string>; write?: { url: string; body: Record<string, unknown> | string; contentType?: string } }
interface IRun { rps: number; p50: number; ok: number }

class Suite {
  constructor(private readonly system: string, private readonly network: string, private readonly suite: ISuite) {}

  private docker(args: string[]): string {
    return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
  }

  private oha(url: string, headers: string[], duration: string, concurrency: number): IRun {
    const target = url.startsWith('re:') ? ['--rand-regex-url', url.slice(3)] : [url];
    const raw = JSON.parse(this.docker(['run', '--rm', '--cpuset-cpus', '1', '--network', this.network, 'ghcr.io/hatoo/oha:latest', '--no-tui', '--output-format', 'json',
      '-z', duration, '-c', String(concurrency), ...headers.flatMap((h) => ['-H', h]), ...target]));
    const statuses = raw.statusCodeDistribution ?? {};
    const total = Object.values(statuses).reduce((a: number, b) => a + Number(b), 0) as number;
    return { rps: raw.summary.requestsPerSec, p50: (raw.latencyPercentiles?.p50 ?? 0) * 1000, ok: total ? Number(statuses['200'] ?? statuses['201'] ?? 0) / total : 0 };
  }

  private writeLoad(seconds: number, concurrency: number): IRun {
    const { url, body } = this.suite.write!;
    const headers: Record<string, string> = { 'content-type': this.suite.write!.contentType ?? 'application/json' };
    for (const h of this.suite.headers ?? []) { const i = h.indexOf(':'); headers[h.slice(0, i).trim().toLowerCase()] = h.slice(i + 1).trim(); }
    if (this.suite.auth) headers.authorization = this.suite.auth;
    const script = `const url=${JSON.stringify(url)},tpl=${JSON.stringify(typeof body === 'string' ? body : JSON.stringify(body))},headers=${JSON.stringify(headers)};
const run=${JSON.stringify(Math.random().toString(36).slice(2, 8))};let n=0,ok=0;const lat=[];const end=Date.now()+${seconds * 1000};
const codes={};async function w(){while(Date.now()<end){const i=n++;const t=Date.now();try{const r=await fetch(url,{method:"POST",headers,body:tpl.split("{n}").join(run+"-"+i)});codes[r.status]=(codes[r.status]||0)+1;if(r.status<300)ok++;await r.arrayBuffer();}catch(e){codes.error=(codes.error||0)+1;}lat.push(Date.now()-t);}}
Promise.all(Array.from({length:${concurrency}},w)).then(()=>{lat.sort((a,b)=>a-b);console.error(JSON.stringify(codes));console.log(JSON.stringify({rps:n/${seconds},p50:lat[Math.floor(lat.length/2)]||0,ok:n?ok/n:0}))})`;
    return JSON.parse(this.docker(['run', '--rm', '--cpuset-cpus', '1', '--network', this.network, 'node:22-bookworm-slim', 'node', '-e', script]));
  }

  private static median(runs: IRun[]): IRun {
    const sorted = [...runs].sort((a, b) => a.rps - b.rps);
    return sorted[Math.floor(sorted.length / 2)];
  }

  run(): void {
    const out: Record<string, IRun> = {};
    const base = this.suite.headers ?? [];
    const authed = this.suite.auth ? [...base, `Authorization: ${this.suite.auth}`] : base;
    const reads: Array<[string, string, string[]]> = [
      ...Object.entries(this.suite.reads).map(([k, v]) => [k, v, base] as [string, string, string[]]),
      ...Object.entries(this.suite.authedReads ?? {}).map(([k, v]) => [k, v, authed] as [string, string, string[]]),
    ];
    for (const [label, url, headers] of reads) {
      this.oha(url, headers, '5s', 16);
      out[label] = Suite.median([1, 2, 3].map(() => this.oha(url, headers, '15s', 32)));
      console.log(`${this.system} ${label}: ${out[label].rps.toFixed(1)} rps  p50 ${out[label].p50.toFixed(1)} ms  ok ${(out[label].ok * 100).toFixed(1)}%`);
    }
    if (this.suite.write) {
      this.writeLoad(5, 8);
      out.create = Suite.median([1, 2, 3].map(() => this.writeLoad(15, 16)));
      console.log(`${this.system} create: ${out.create.rps.toFixed(1)} rps  p50 ${out.create.p50.toFixed(1)} ms  ok ${(out.create.ok * 100).toFixed(1)}%`);
    }
    mkdirSync('results', { recursive: true });
    writeFileSync(`results/${this.system}.json`, JSON.stringify({ system: this.system, at: new Date().toISOString(), results: out }, null, 2));
  }
}

const [system, network, file] = process.argv.slice(2);
new Suite(system, network, JSON.parse(readFileSync(file, 'utf8'))).run();
