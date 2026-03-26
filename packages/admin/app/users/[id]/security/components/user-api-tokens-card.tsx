"use client";

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader } from '@/components/ui/loader';
import { FrameworkIcons } from '@/lib/icons';
import type { UserApiTokenRecord } from '../user-security-page.interfaces';

export default function UserApiTokensCard({
  createdToken,
  isDark,
  onCreateToken,
  onRevokeToken,
  setTokenDays,
  setTokenName,
  tokenDays,
  tokenName,
  tokens,
  tokensLoading,
}: {
  createdToken: string;
  isDark: boolean;
  onCreateToken: () => Promise<void>;
  onRevokeToken: (tokenId: string) => Promise<void>;
  setTokenDays: (value: string) => void;
  setTokenName: (value: string) => void;
  tokenDays: string;
  tokenName: string;
  tokens: UserApiTokenRecord[];
  tokensLoading: boolean;
}) {
  return (
    <Card title="Personal API Tokens" icon={<FrameworkIcons.Key size={18} className="text-indigo-500" />}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3"><div className="md:col-span-5"><Input placeholder="Token name (e.g. CI deploy)" value={tokenName} onChange={(event) => setTokenName(event.target.value)} /></div><div className="md:col-span-3"><Input type="number" min={1} max={3650} placeholder="Days" value={tokenDays} onChange={(event) => setTokenDays(event.target.value)} /></div><div className="md:col-span-4"><Button className="w-full font-bold text-xs tracking-tight uppercase" onClick={() => void onCreateToken()}>Create Token</Button></div></div>
        {createdToken ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-[10px] font-bold uppercase tracking-tight text-amber-600 mb-2">Copy Now (shown once)</p><code className="text-[11px] break-all font-mono text-amber-800">{createdToken}</code></div> : null}
        {tokensLoading ? <Loader label="Loading API tokens..." /> : tokens.length === 0 ? <div className="text-xs font-bold uppercase tracking-tight text-slate-400 py-2">No API tokens created yet.</div> : <div className="space-y-2">{tokens.map((token) => <div key={String(token.id)} className={`p-3 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}><div className="flex items-center justify-between gap-3"><div className="space-y-1"><p className="text-xs font-bold text-slate-700 dark:text-slate-200">{String(token.name || 'Token')}</p><p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">{String(token.prefix || 'fct_***')} • Created {token.createdAt ? new Date(token.createdAt).toLocaleDateString() : 'n/a'}</p>{token.revokedAt ? <p className="text-[10px] font-bold uppercase tracking-tight text-rose-500">Revoked {new Date(token.revokedAt).toLocaleString()}</p> : null}</div>{!token.revokedAt ? <Button variant="outline" size="sm" className="text-[10px] font-bold uppercase tracking-tight" onClick={() => void onRevokeToken(String(token.id))}>Revoke</Button> : null}</div></div>)}</div>}
      </div>
    </Card>
  );
}
