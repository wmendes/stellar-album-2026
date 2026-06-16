import { createContext, useContext, useState, type ReactNode } from "react";
import { connect as walletConnect } from "./lib/wallet";
import { ensureFunded } from "./lib/friendbot";
import { makeClients } from "./lib/clients";
import { TYPES } from "./lib/catalog";

type Clients = ReturnType<typeof makeClients>;

/** An open escrow offer, flattened for the UI. */
export interface Offer {
  id: string;
  maker: string;
  give: number;
  want: number;
}

async function readCollection(c: Clients, owner: string): Promise<number[]> {
  return Promise.all(
    TYPES.map((t) => c.sticker.balance({ owner, sticker_type: t }).then((r) => Number(r.result))),
  );
}

async function readOffers(c: Clients): Promise<Offer[]> {
  const r = await c.escrow.offers();
  return r.result.map((o) => ({ id: String(o.id), maker: o.maker, give: o.give_type, want: o.want_type }));
}

export interface Store {
  address?: string;
  coin: number;
  packs: number;
  collection: number[];
  pasted: boolean[];
  offers: Offer[];
  hasAlbum: boolean;
  claimAt: number;
  busy?: string;
  error?: string;
  reveal?: number[];
  connect(): Promise<void>;
  claim(): Promise<void>;
  buy(): Promise<void>;
  open(): Promise<void>;
  dismissReveal(): void;
  openAlbum(): Promise<void>;
  paste(t: number): Promise<boolean>;
  createOffer(give: number, want: number): Promise<string | undefined>;
  acceptOffer(id: string): Promise<void>;
  cancelOffer(id: string): Promise<void>;
  reloadOffers(): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used within StoreProvider");
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string>();
  const [clients, setClients] = useState<Clients>();
  const [coin, setCoin] = useState(0);
  const [packs, setPacks] = useState(0);
  const [collection, setCollection] = useState<number[]>([]);
  const [pasted, setPasted] = useState<boolean[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [hasAlbum, setHasAlbum] = useState(false);
  const [claimAt, setClaimAt] = useState(0);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [reveal, setReveal] = useState<number[]>();

  async function refresh(c: Clients, addr: string): Promise<number[]> {
    const [coinR, packR, lastR, cdR, hasAlbumR] = await Promise.all([
      c.coin.balance({ account: addr }),
      c.pack.balance({ owner: addr }),
      c.faucet.last_claim({ claimer: addr }),
      c.faucet.cooldown(),
      c.album.has_album({ owner: addr }),
    ]);
    setCoin(Number(coinR.result));
    setPacks(Number(packR.result));
    setClaimAt(Number(lastR.result) === 0 ? 0 : Number(lastR.result) + Number(cdR.result));
    setHasAlbum(Boolean(hasAlbumR.result));
    const [coll, past, offs] = await Promise.all([
      readCollection(c, addr),
      Promise.all(TYPES.map((t) => c.album.is_pasted({ owner: addr, sticker_type: t }).then((r) => Boolean(r.result)))),
      readOffers(c),
    ]);
    setCollection(coll);
    setPasted(past);
    setOffers(offs);
    return coll;
  }

  async function run<T>(label: string, fn: (c: Clients, addr: string) => Promise<T>): Promise<T | undefined> {
    if (!clients || !address) return undefined;
    setBusy(label);
    setError(undefined);
    try {
      return await fn(clients, address);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      setBusy(undefined);
    }
  }

  const connect = async () => {
    setBusy("Connecting");
    setError(undefined);
    try {
      const addr = await walletConnect();
      await ensureFunded(addr);
      const c = makeClients(addr);
      setAddress(addr);
      setClients(c);
      await refresh(c, addr);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(undefined);
    }
  };

  const sendThen = (label: string, build: (c: Clients, addr: string) => Promise<{ signAndSend(): Promise<unknown> }>) =>
    run(label, async (c, addr) => {
      await (await build(c, addr)).signAndSend();
      await refresh(c, addr);
    }).then(() => undefined);

  const claim = () => sendThen("Claiming coins", (c, addr) => c.faucet.claim({ claimer: addr }));
  const buy = () => sendThen("Buying a pack", (c, addr) => c.store.buy_pack({ buyer: addr }));
  const openAlbum = () => sendThen("Binding album", (c, addr) => c.album.open_album({ owner: addr }));
  const paste = (t: number) =>
    run("Pasting", async (c, addr) => {
      await (await c.album.paste({ owner: addr, sticker_type: t })).signAndSend();
      await refresh(c, addr);
      return true;
    }).then((ok) => ok === true);
  const acceptOffer = (id: string) => sendThen("Accepting offer", (c, addr) => c.escrow.accept_offer({ taker: addr, offer_id: BigInt(id) }));
  const cancelOffer = (id: string) => sendThen("Taking it back", (c) => c.escrow.cancel_offer({ offer_id: BigInt(id) }));

  const open = async () => {
    setReveal(undefined);
    await run("Ripping the pack", async (c, addr) => {
      const before = await refresh(c, addr);
      const sent = await (await c.pack.open({ opener: addr })).signAndSend();
      const resp = sent.getTransactionResponse as unknown as { status?: string };
      if (resp?.status && resp.status !== "SUCCESS") throw new Error(`pack open reverted on-chain (status=${resp.status})`);
      const after = await refresh(c, addr);
      const d: number[] = [];
      for (const t of TYPES) for (let k = 0; k < after[t] - before[t]; k++) d.push(t);
      if (d.length === 0) throw new Error("pack opened but no new stickers were detected");
      setReveal(d);
    });
  };

  const dismissReveal = () => setReveal(undefined);

  const reloadOffers = async () => {
    if (clients) setOffers(await readOffers(clients));
  };

  const createOffer = (give: number, want: number) =>
    run("Putting it on the table", async (c, addr) => {
      const sent = await (await c.escrow.create_offer({ maker: addr, give_type: give, want_type: want })).signAndSend();
      let id = "?";
      try {
        id = String(sent.result);
      } catch {
        /* best-effort id */
      }
      await refresh(c, addr);
      return id;
    });

  const value: Store = {
    address, coin, packs, collection, pasted, offers, hasAlbum, claimAt, busy, error, reveal,
    connect, claim, buy, open, dismissReveal, openAlbum, paste, createOffer, acceptOffer, cancelOffer, reloadOffers,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
