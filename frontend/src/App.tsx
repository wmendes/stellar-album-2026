import { useState } from "react";
import { connect } from "./lib/wallet";
import { ensureFunded } from "./lib/friendbot";
import { makeClients } from "./lib/clients";
import { stickerName, tier, TIER_STYLE, TYPE_COUNT } from "./lib/catalog";

type Clients = ReturnType<typeof makeClients>;

function fmtRemaining(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.max(1, Math.floor(sec))}s`;
}

/** Read the owner's balance of every sticker type (length TYPE_COUNT). */
async function readCollection(c: Clients, owner: string): Promise<number[]> {
  const reads = Array.from({ length: TYPE_COUNT }, (_, t) =>
    c.sticker.balance({ owner, sticker_type: t }).then((r) => Number(r.result)),
  );
  return Promise.all(reads);
}

export default function App() {
  const [address, setAddress] = useState<string>();
  const [clients, setClients] = useState<Clients>();
  const [coin, setCoin] = useState<number>(0);
  const [packs, setPacks] = useState<number>(0);
  const [collection, setCollection] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<number[]>();
  const [claimAt, setClaimAt] = useState<number>(0); // unix sec the next claim is allowed (0 = now)
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
  const now = Date.now() / 1000;
  const claimReady = claimAt === 0 || now >= claimAt;

  async function refresh(c: Clients, addr: string): Promise<number[]> {
    const bal = await c.coin.balance({ account: addr });
    setCoin(Number(bal.result));
    const p = await c.pack.balance({ owner: addr });
    setPacks(Number(p.result));
    const last = Number((await c.faucet.last_claim({ claimer: addr })).result);
    const cd = Number((await c.faucet.cooldown()).result);
    setClaimAt(last === 0 ? 0 : last + cd);
    const coll = await readCollection(c, addr);
    setCollection(coll);
    return coll;
  }

  async function run<T>(label: string, fn: () => Promise<T>) {
    setBusy(label);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(undefined);
    }
  }

  const onConnect = () =>
    run("Connecting", async () => {
      const addr = await connect();
      await ensureFunded(addr);
      const c = makeClients(addr);
      setAddress(addr);
      setClients(c);
      await refresh(c, addr);
    });

  const onClaim = () =>
    run("Claiming", async () => {
      const tx = await clients!.faucet.claim({ claimer: address! });
      await tx.signAndSend();
      await refresh(clients!, address!);
    });

  const onBuy = () =>
    run("Buying pack", async () => {
      const tx = await clients!.store.buy_pack({ buyer: address! });
      await tx.signAndSend();
      await refresh(clients!, address!);
    });

  const onOpen = () =>
    run("Opening pack", async () => {
      setDrawn(undefined);
      // Read the drawn stickers from on-chain state (balance diff) rather than
      // parsing the tx return value — robust across SDK result-parsing quirks,
      // and authoritative (reflects what was actually minted).
      const before = await readCollection(clients!, address!);
      const tx = await clients!.pack.open({ opener: address! });
      const sent = await tx.signAndSend();

      // signAndSend does NOT throw on an on-chain failure unless you read
      // .result — so check the status explicitly and surface diagnostics.
      const resp = sent.getTransactionResponse as unknown as {
        status?: string;
        resultXdr?: unknown;
        diagnosticEventsXdr?: unknown;
      };
      console.log("open tx status:", resp?.status, resp);
      if (resp?.status && resp.status !== "SUCCESS") {
        throw new Error(`open reverted on-chain (status=${resp.status}); see console for diagnostics`);
      }

      const after = await refresh(clients!, address!);
      const drawn: number[] = [];
      for (let t = 0; t < TYPE_COUNT; t++) {
        for (let k = 0; k < after[t] - before[t]; k++) drawn.push(t);
      }
      if (drawn.length === 0) {
        throw new Error("open succeeded but no new stickers were detected — see console tx log");
      }
      setDrawn(drawn);
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white text-slate-800">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/70 backdrop-blur">
        <h1 className="text-xl font-bold">⭐ Stellar Album</h1>
        {address ? (
          <div className="flex items-center gap-4 text-sm">
            {/* Fungible: a pure balance, no identity */}
            <span className="rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-800">
              {coin} ⭐
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{packs} packs</span>
            <span className="text-slate-500">{short(address)}</span>
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Connect wallet
          </button>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
        {!address && (
          <p className="text-center text-slate-500">
            Connect a wallet to claim coins, buy a pack, and open it.
          </p>
        )}

        {address && (
          <section className="grid grid-cols-3 gap-3">
            <Action
              label="Claim coins"
              hint={claimReady ? "from the Faucet" : `next in ${fmtRemaining(claimAt - now)}`}
              onClick={onClaim}
              disabled={!!busy || !claimReady}
            />
            <Action
              label="Buy pack"
              hint="100 ⭐"
              onClick={onBuy}
              disabled={!!busy || coin < 100}
            />
            <Action
              label="Open pack"
              hint={packs > 0 ? "reveal 3 stickers" : "no packs"}
              onClick={onOpen}
              disabled={!!busy || packs < 1}
            />
          </section>
        )}

        {busy && <p className="text-center text-indigo-600 animate-pulse">{busy}…</p>}
        {error && (
          <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        {drawn && (
          <section>
            <h2 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-slate-400">
              You pulled
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {drawn.map((t, i) => (
                <Sticker key={i} typeId={t} />
              ))}
            </div>
          </section>
        )}

        {address && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Your collection
              </h2>
              <span className="text-sm text-slate-500">
                {collection.filter((n) => n > 0).length}/{TYPE_COUNT} types
              </span>
            </div>
            {collection.every((n) => n === 0) ? (
              <p className="text-center text-slate-400">No stickers yet — open a pack!</p>
            ) : (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                {collection.map((n, t) =>
                  n > 0 ? <Sticker key={t} typeId={t} qty={n} /> : null,
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Action({
  label,
  hint,
  onClick,
  disabled,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-4 py-5 shadow-sm transition hover:shadow-md disabled:opacity-40 disabled:hover:shadow-sm"
    >
      <span className="font-semibold">{label}</span>
      <span className="text-xs text-slate-500">{hint}</span>
    </button>
  );
}

// Non-fungible-ish: an identifiable object with a name + rarity, not a number.
// `qty` (when shown in the collection) is the count of this type held — the
// semi-fungible part: duplicates of one type stack.
function Sticker({ typeId, qty }: { typeId: number; qty?: number }) {
  const t = tier(typeId);
  return (
    <div
      className={`relative flex aspect-[3/4] flex-col items-center justify-center rounded-xl bg-gradient-to-b ring-2 ${TIER_STYLE[t]}`}
    >
      {qty != null && qty > 1 && (
        <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-xs font-bold text-white">
          ×{qty}
        </span>
      )}
      <div className="text-3xl">🧑‍🚀</div>
      <div className="mt-2 text-sm font-bold">{stickerName(typeId)}</div>
      <div className="text-xs uppercase tracking-wide opacity-80">{t}</div>
    </div>
  );
}
