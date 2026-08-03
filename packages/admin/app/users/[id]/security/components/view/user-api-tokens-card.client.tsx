import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Loader } from '@/components/ui/view/loader.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IUserApiTokenRecord } from '@/app/users/[id]/security/interfaces/user-api-token-record.interface';
import { AdminClass } from '@/lib/admin-class';

export class UserApiTokensCard extends PureReactor {
  @prop declare createdToken: string;
  @prop declare isDark: boolean;
  @prop declare onCreateToken: () => Promise<void>;
  @prop declare onRevokeToken: (tokenId: string) => Promise<void>;
  @prop declare setTokenDays: (value: string) => void;
  @prop declare setTokenName: (value: string) => void;
  @prop declare tokenDays: string;
  @prop declare tokenName: string;
  @prop declare tokens: IUserApiTokenRecord[];
  @prop declare tokensLoading: boolean;

  render(): ReactNode {
    const {
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
} = this;
  return (
    <Card title="Personal API Tokens" icon={<FrameworkIcons.Key size={18} className="text-indigo-500" />}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3"><div className="md:col-span-5"><Input placeholder="Token name (e.g. CI deploy)" value={tokenName} onChange={(event) => setTokenName(event.target.value)} /></div><div className="md:col-span-3"><NumberStepper min={1} max={3650} placeholder="Days" value={tokenDays} onChange={(v) => setTokenDays(v === '' ? '' : String(v))} /></div><div className="md:col-span-4"><Button className="w-full font-bold text-xs tracking-tight uppercase" onClick={() => void onCreateToken()}>Create Token</Button></div></div>
        {createdToken ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-[10px] font-bold uppercase tracking-tight text-amber-600 mb-2">Copy Now (shown once)</p><code className="text-[11px] break-all font-mono text-amber-800">{createdToken}</code></div> : null}
        {tokensLoading ? <Loader label="Loading API tokens..." /> : tokens.length === 0 ? <div className="text-xs font-bold uppercase tracking-tight text-slate-400 py-2">No API tokens created yet.</div> : <div className="space-y-2">{tokens.map((token) => <div key={String(token.id)} className={`p-3 ${AdminClass.SURFACE} ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}><div className="flex items-center justify-between gap-3"><div className="space-y-1"><p className="text-xs font-bold text-slate-700 dark:text-slate-200">{String(token.name || 'Token')}</p><p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">{String(token.prefix || 'fct_***')} • Created {token.createdAt ? new Date(token.createdAt).toLocaleDateString() : 'n/a'}</p>{token.revokedAt ? <p className="text-[10px] font-bold uppercase tracking-tight text-rose-500">Revoked {new Date(token.revokedAt).toLocaleString()}</p> : null}</div>{!token.revokedAt ? <Button variant={ButtonVariant.OUTLINE} size={FieldSize.SM} className="text-[10px] font-bold uppercase tracking-tight" onClick={() => void onRevokeToken(String(token.id))}>Revoke</Button> : null}</div></div>)}</div>}
      </div>
    </Card>
  );
  }
}
