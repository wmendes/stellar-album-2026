import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, type Offer } from "../store";
import { Page, SectionHead, Toast } from "../components/ui";
import { Dialog, CloseButton, ConfirmDialog } from "../components/Dialog";
import { TYPES } from "../lib/catalog";
import { Sticker } from "../components/Sticker";
import { stickerName } from "../lib/stickers";

type Picking = "give" | "want" | null;

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

// A small "give ⇄ want" pair of sticker cards, reused in the confirmation and
// in every marketplace row.
function SwapPair({ give, want, size = "w-20", center = false }: { give: number; want: number; size?: string; center?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${center ? "justify-center" : ""}`}>
      <div className={size}><Sticker typeId={give} /></div>
      <span aria-hidden className="text-lg text-ink-soft">⇄</span>
      <div className={size}><Sticker typeId={want} /></div>
    </div>
  );
}

// One open offer in the marketplace: shows exactly what's traded for what, who
// posted it, and whether you can fill it.
function OfferCard({
  offer,
  mine,
  canAccept,
  lastCopy,
  busy,
  pending,
  onAccept,
  onCancel,
}: {
  offer: Offer;
  mine: boolean;
  canAccept: boolean;
  lastCopy: boolean;
  busy: boolean;
  pending: boolean;
  onAccept: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl bg-paper p-4 ring-1 ring-edge">
      <SwapPair give={offer.give} want={offer.want} center={mine} />
      <div className="text-xs text-ink-soft">
        <span className="font-semibold text-ink">{stickerName(offer.give)}</span> for{" "}
        <span className="font-semibold text-ink">{stickerName(offer.want)}</span>
        <br />
        <span>#{offer.id} · {mine ? "your offer" : `by ${short(offer.maker)}`}</span>
      </div>
      {mine ? (
        <button
          onClick={onCancel}
          disabled={busy}
          className="mt-auto rounded-full px-4 py-2 text-sm font-bold text-leaf-deep underline-offset-2 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:opacity-40"
        >
          {pending ? "Taking it back…" : "Take it back"}
        </button>
      ) : (
        <div className="mt-auto flex flex-col gap-1">
          <button
            onClick={onAccept}
            disabled={busy || !canAccept}
            className="rounded-full bg-leaf-deep px-4 py-2 text-sm font-bold text-paper transition hover:bg-leaf focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:opacity-40"
          >
            {pending ? "Accepting…" : `Accept — trade your ${stickerName(offer.want)}`}
          </button>
          {!canAccept ? (
            <span className="text-center text-[11px] font-semibold text-ink-soft">
              You need {stickerName(offer.want)} to accept
            </span>
          ) : lastCopy ? (
            <span className="text-center text-[11px] font-semibold text-ink-soft">
              Your only {stickerName(offer.want)} — you'll give it away
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Carousel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const [overflow, setOverflow] = useState(false);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
    setOverflow(el.scrollWidth > el.clientWidth + 1);
  };

  useEffect(() => { sync(); });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const page = (dir: -1 | 1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  const arrow =
    "absolute top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-paper text-xl font-bold text-ink shadow-md ring-1 ring-edge transition hover:bg-cream focus-visible:outline-2 focus-visible:outline-leaf disabled:pointer-events-none disabled:opacity-0";

  return (
    <div className="relative">
      {overflow && (
        <button aria-label="Scroll left" onClick={() => page(-1)} disabled={atStart} className={`${arrow} -left-2`}>
          ‹
        </button>
      )}
      <div
        ref={ref}
        onScroll={sync}
        className="flex gap-3 overflow-x-auto scroll-smooth p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {overflow && (
        <button aria-label="Scroll right" onClick={() => page(1)} disabled={atEnd} className={`${arrow} -right-2`}>
          ›
        </button>
      )}
    </div>
  );
}

// A tappable slot in the "you give ⇄ you want" preview row. An offer always
// moves a single sticker, so we never stamp the owned-count badge here (it read
// as "trade all of them"); ownership is shown as a caption instead.
function Slot({ label, typeId, owned, onClick }: { label: string; typeId?: number; owned?: number; onClick: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      <button
        onClick={onClick}
        className="group relative w-full max-w-36 rounded-2xl ring-2 ring-transparent transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf hover:ring-leaf/50"
      >
        {typeId != null ? (
          <Sticker typeId={typeId} big />
        ) : (
          <span className="grid aspect-[3/4] w-full place-items-center rounded-2xl bg-paper text-sm text-ink-soft ring-1 ring-edge">
            nothing yet
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 z-30 rounded-b-2xl bg-leaf-deep/0 py-1 text-center text-[11px] font-bold text-paper opacity-0 transition group-hover:bg-leaf-deep/80 group-hover:opacity-100">
          Change
        </span>
      </button>
      {typeId != null && owned != null && owned > 1 && (
        <span className="text-[11px] text-ink-soft">Trading 1 of {owned} you own</span>
      )}
    </div>
  );
}

// Modal sticker grid for choosing a give/want type. Reuses the Shop reveal
// overlay pattern. `items` are the selectable type ids.
function PickerModal({
  title,
  items,
  collection,
  pasted,
  owned,
  onPick,
  onClose,
}: {
  title: string;
  items: number[];
  collection: number[];
  pasted: boolean[];
  owned: boolean;
  onPick: (t: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog onClose={onClose} labelledBy={titleId} panelClassName="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-paper p-5 shadow-xl ring-1 ring-edge">
      <div className="mb-4 flex items-center justify-between">
        <h3 id={titleId} className="font-display text-lg font-bold text-ink">{title}</h3>
        <CloseButton onClick={onClose} className="text-ink-soft hover:bg-kraft" />
      </div>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">
          You don't have any stickers to give yet — rip open a pack first.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((t) => {
            // "Have it" means it's in your drawer OR already pasted in your
            // album — a pasted sticker is burned from the collection, so it
            // must still count as owned here, not "missing".
            const has = (collection[t] ?? 0) > 0 || !!pasted[t];
            return (
              <motion.button
                key={t}
                layout
                whileHover={{ y: -4 }}
                onClick={() => onPick(t)}
                className="flex flex-col gap-1 rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
              >
                <Sticker typeId={t} qty={owned ? collection[t] : undefined} />
                {/* In the "want" picker, the sticker you're missing is the one
                    you'd want — so lead with that, and soft-flag ones you own. */}
                {!owned && (
                  <span className={`text-center text-[11px] font-semibold ${has ? "text-ink-soft" : "text-leaf-deep"}`}>
                    {has ? "you already have this" : "✦ missing — good pick"}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}

export default function Trade() {
  const { address, collection, pasted, offers, busy, error, clearError, createOffer, acceptOffer, cancelOffer, reloadOffers } = useStore();
  const owned = TYPES.filter((t) => (collection[t] ?? 0) > 0);

  const [give, setGive] = useState<number | undefined>();
  const [want, setWant] = useState<number | undefined>();
  const [picking, setPicking] = useState<Picking>(null);
  const [created, setCreated] = useState<{ id: string; give: number; want: number }>();
  const [pendingId, setPendingId] = useState<string | null>(null); // offer being accepted/cancelled
  const [confirmAccept, setConfirmAccept] = useState<Offer | null>(null);

  // Pull the latest open offers when the page opens (others may have posted
  // since connect). Subsequent create/accept/cancel refresh automatically.
  useEffect(() => {
    reloadOffers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // If our posted offer is filled or cancelled (no longer in the open list),
  // retire the stale "on the table" confirmation so it can't contradict reality.
  useEffect(() => {
    if (created && created.id !== "?" && !offers.some((o) => o.id === created.id)) setCreated(undefined);
  }, [offers, created]);

  // Sensible defaults once the collection loads: give = first owned, want =
  // first type you don't own. Re-correct give if it ever points to a type you
  // no longer own (e.g. after an offer is accepted).
  useEffect(() => {
    if (owned.length === 0) {
      setGive(undefined);
      return;
    }
    setGive((g) => (g != null && owned.includes(g) ? g : owned[0]));
    setWant((w) => {
      if (w != null) return w;
      return TYPES.find((t) => !owned.includes(t)) ?? (owned[0] + 1) % TYPES.length;
    });
  }, [collection]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (t: number) => {
    if (picking === "give") {
      setGive(t);
      if (want === t) setWant(TYPES.find((x) => x !== t));
    } else if (picking === "want") {
      setWant(t);
      if (give === t) setGive(owned.find((x) => x !== t));
    }
    setPicking(null);
  };

  const onCreate = async () => {
    if (give == null || want == null) return;
    const id = await createOffer(give, want);
    if (id) setCreated({ id, give, want });
  };
  const onCancel = async (id: string) => {
    setPendingId(id);
    await cancelOffer(id);
    setPendingId(null);
    setCreated(undefined);
  };
  const onAccept = async (o: Offer) => {
    setConfirmAccept(null);
    setPendingId(o.id);
    await acceptOffer(o.id);
    setPendingId(null);
  };

  const ready = give != null && want != null && give !== want;
  const isLastCopy = (t: number) => (collection[t] ?? 0) === 1;
  // Surface the best trade fuel first: most duplicates at the top (stable sort
  // keeps type-id order within an equal count).
  const giveItems = owned.filter((t) => t !== want).sort((a, b) => (collection[b] ?? 0) - (collection[a] ?? 0));
  const wantItems = TYPES.filter((t) => t !== give);

  const mine = useMemo(() => offers.filter((o) => o.maker === address), [offers, address]);
  const others = useMemo(() => {
    const canAccept = (o: Offer) => (collection[o.want] ?? 0) > 0;
    return offers
      .filter((o) => o.maker !== address)
      .sort((a, b) => Number(canAccept(b)) - Number(canAccept(a)));
  }, [offers, collection, address]);

  return (
    <Page>
      <SectionHead
        title="Trade"
        sub="A swap runs through an escrow contract: no middleman holds your sticker, the code does. It is why a smart contract earns its place here."
      />

      {/* Make an offer ---------------------------------------------------- */}
      <div className="rounded-2xl bg-cream p-6 ring-1 ring-edge">
        <h3 className="font-display text-lg font-bold text-ink">Make an offer</h3>

        {owned.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">You need a sticker to trade. Rip open a pack, then come back.</p>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-2 sm:gap-4">
              <Slot label="You give" typeId={give} owned={give != null ? collection[give] : undefined} onClick={() => setPicking("give")} />
              <span aria-hidden className="mt-6 select-none text-2xl text-ink-soft sm:text-3xl">⇄</span>
              <Slot label="You want" typeId={want} onClick={() => setPicking("want")} />
            </div>

            {give != null && isLastCopy(give) && (
              <p className="mt-4 flex gap-2 rounded-lg bg-paper px-3 py-2 text-xs text-ink-soft ring-1 ring-edge">
                <span aria-hidden>⚠️</span>
                <span>
                  Your <b>only</b> {stickerName(give)}. Trade it and it's gone — offer a duplicate instead when you have one.
                </span>
              </p>
            )}

            <div className="mt-5 flex justify-center">
              <button
                onClick={onCreate}
                disabled={!!busy || !ready}
                className="rounded-full bg-leaf-deep px-6 py-2.5 font-display text-sm font-bold text-paper transition hover:bg-leaf focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:opacity-40"
              >
                Put it on the table
              </button>
            </div>
          </>
        )}

        {created && (
          <div className="mt-5 rounded-xl bg-leaf-tint p-4">
            <p className="text-sm font-semibold text-leaf-deep">🔒 {created.id !== "?" ? `Offer #${created.id}` : "Your offer"} is on the table</p>
            <div className="mt-3">
              <SwapPair give={created.give} want={created.want} />
            </div>
            <p className="mt-3 text-xs text-leaf-deep">
              Your {stickerName(created.give)} is held in escrow until someone trades their {stickerName(created.want)} for it — it now shows
              under Your offers below, or you can{" "}
              <button onClick={() => onCancel(created.id)} disabled={!!busy} className="font-bold underline disabled:opacity-50">
                take it back
              </button>
              .
            </p>
          </div>
        )}
      </div>

      {/* Your offers ------------------------------------------------------ */}
      {mine.length > 0 && (
        <div className="mt-6 rounded-2xl bg-cream p-6 ring-1 ring-edge">
          <h3 className="font-display text-lg font-bold text-ink">Your offers</h3>
          <p className="mt-1 max-w-prose text-sm text-ink-soft">
            Swaps you've put on the table. Each sticker sits in escrow until someone fills it — or you take it back.
          </p>
          <div className="mt-4">
            <Carousel>
              {mine.map((o) => (
                <div key={o.id} className="w-64 shrink-0 snap-start">
                  <OfferCard
                    offer={o}
                    mine
                    canAccept={false}
                    lastCopy={false}
                    busy={!!busy}
                    pending={pendingId === o.id}
                    onAccept={() => {}}
                    onCancel={() => onCancel(o.id)}
                  />
                </div>
              ))}
            </Carousel>
          </div>
        </div>
      )}

      {/* Open offers (marketplace) ---------------------------------------- */}
      <div className="mt-6 rounded-2xl bg-cream p-6 ring-1 ring-edge">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">Open offers</h3>
          <button
            onClick={reloadOffers}
            disabled={!!busy}
            className="rounded-full px-3 py-1 text-sm font-semibold text-ink-soft transition hover:bg-paper disabled:opacity-40"
          >
            ↻ Refresh
          </button>
        </div>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">
          Swaps posted by other collectors. Accepting is atomic — both stickers move together, or nothing does.
        </p>

        {others.length === 0 ? (
          <p className="mt-5 rounded-xl bg-paper px-4 py-8 text-center text-sm text-ink-soft ring-1 ring-edge">
            No offers from other collectors right now. Check back later.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {others.map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                mine={false}
                canAccept={(collection[o.want] ?? 0) > 0}
                lastCopy={isLastCopy(o.want)}
                busy={!!busy}
                pending={pendingId === o.id}
                onAccept={() => setConfirmAccept(o)}
                onCancel={() => onCancel(o.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Toast busy={busy} error={error} onDismiss={clearError} />

      <AnimatePresence>
        {confirmAccept && (
          <ConfirmDialog
            title={`Trade for ${stickerName(confirmAccept.give)}?`}
            confirmLabel="Trade"
            busy={!!busy}
            onClose={() => setConfirmAccept(null)}
            onConfirm={() => onAccept(confirmAccept)}
            body={
              <>
                You'll give your <b>{stickerName(confirmAccept.want)}</b> and receive their <b>{stickerName(confirmAccept.give)}</b>. The swap is atomic — both move together.
                {isLastCopy(confirmAccept.want) && (
                  <>
                    {" "}
                    This is your <b>only copy</b> of {stickerName(confirmAccept.want)}.
                  </>
                )}
              </>
            }
          />
        )}
        {picking === "give" && (
          <PickerModal
            title="Choose what you'll give"
            items={giveItems}
            collection={collection}
            pasted={pasted}
            owned
            onPick={onPick}
            onClose={() => setPicking(null)}
          />
        )}
        {picking === "want" && (
          <PickerModal
            title="Choose what you want"
            items={wantItems}
            collection={collection}
            pasted={pasted}
            owned={false}
            onPick={onPick}
            onClose={() => setPicking(null)}
          />
        )}
      </AnimatePresence>
    </Page>
  );
}
