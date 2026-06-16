import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useStore } from "../store";
import { Page } from "../components/ui";
import { Sticker } from "../components/Sticker";

// Live deployment values (mirror bootstrap.sh constructor args + contracts/common).
const FIRST_CLAIM = 1000;
const CLAIM = 100;
const PACK_PRICE = 100;
const PACK_SIZE = 3;
const TYPE_COUNT = 20;

const EASE = [0.22, 1, 0.36, 1] as const;
const stagger = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: 0.05 + i * 0.07, ease: EASE },
});

// The loop, in the order you actually play it — each step is one point on the
// fungibility spectrum, told in plain language with the real number attached.
const STEPS: { n: string; title: string; body: string; note: string }[] = [
  {
    n: "1",
    title: "Claim your coins",
    body: "Coins are your spending money. Tap claim and they land in your balance — no wallet top-up, no fees.",
    note: `${FIRST_CLAIM} ⭐ on your first claim, then ${CLAIM} ⭐ each time after. The faucet refills every few hours.`,
  },
  {
    n: "2",
    title: "Buy a sealed pack",
    body: "Spend coins on a pack. Every sealed pack is identical — there's nothing special inside until you open it.",
    note: `${PACK_PRICE} ⭐ a pack — exactly one claim's worth.`,
  },
  {
    n: "3",
    title: "Rip it open",
    body: "This is the moment. A sealed pack bursts into specific people — that's a pile of “any pack” turning into named stickers you can recognise.",
    note: `${PACK_SIZE} random stickers per pack. Doubles can happen.`,
  },
  {
    n: "4",
    title: "Paste them in",
    body: "Press a sticker into your album to fill that person's slot. Pasting is forever: it can't be peeled out or traded again — so a finished album is something only you could have built.",
    note: `${TYPE_COUNT} people to collect. Your album is soulbound — it can never be sold or moved.`,
  },
  {
    n: "5",
    title: "Trade your doubles",
    body: "Pulled the same person twice? Offer your spare for someone you're missing. The swap is all-or-nothing — both stickers move together, or neither does. No trust required.",
    note: "Stickers for stickers only — coins never enter a trade.",
  },
];

function SpectrumNode({ label, caption, accent }: { label: string; caption: string; accent: string }) {
  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <span className={`h-3 w-3 rounded-full ${accent} ring-4 ring-paper`} />
      <span className="mt-2 font-display text-sm font-bold text-ink">{label}</span>
      <span className="mt-0.5 max-w-[12rem] text-xs leading-snug text-ink-soft">{caption}</span>
    </div>
  );
}

function RarityCard({ typeId, tierName, count, odds }: { typeId: number; tierName: string; count: string; odds: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-20 sm:w-24">
        <Sticker typeId={typeId} />
      </div>
      <div className="text-center">
        <div className="font-display text-sm font-bold text-ink">{tierName}</div>
        <div className="text-xs text-ink-soft">{count}</div>
        <div className="mt-0.5 font-display text-sm font-bold text-leaf-deep">{odds}</div>
      </div>
    </div>
  );
}

export default function Guide() {
  const { address, connect, busy } = useStore();

  return (
    <Page>
      <motion.div {...stagger(0)}>
        <p className="font-display text-sm font-bold uppercase tracking-wide text-leaf-deep">How it works</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Collect the people who build Stellar.
        </h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          It's a sticker album. Claim coins, rip open packs, and paste your favourites into an album that's yours
          alone — then swap your doubles to finish the set. Here's the whole game.
        </p>
      </motion.div>

      {/* The spectrum — the one idea the whole album is built to show. */}
      <motion.div {...stagger(1)} className="mt-8 rounded-2xl bg-kraft p-5 ring-1 ring-edge">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Three kinds of things you own
        </p>
        <div className="relative mt-5 flex items-start justify-between gap-2">
          <div className="absolute inset-x-8 top-1.5 -z-0 h-0.5 rounded-full bg-gradient-to-r from-leaf via-rare to-gold" />
          <SpectrumNode label="Coins" caption="Every one is the same. Just a number that goes up and down." accent="bg-leaf" />
          <SpectrumNode label="Stickers" caption="A person has copies, but one person is not another." accent="bg-rare" />
          <SpectrumNode label="Album" caption="One per collector. Unique, and impossible to hand off." accent="bg-gold" />
        </div>
      </motion.div>

      {/* The loop, step by step. */}
      <div className="mt-10 space-y-3">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            {...stagger(i + 2)}
            className="flex gap-4 rounded-2xl bg-paper p-4 ring-1 ring-edge sm:p-5"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-leaf-deep font-display text-base font-extrabold text-paper">
              {s.n}
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">{s.title}</h2>
              <p className="mt-1 max-w-prose text-sm text-ink-soft">{s.body}</p>
              <p className="mt-2 inline-block rounded-full bg-leaf-tint px-3 py-1 text-xs font-semibold text-leaf-deep">
                {s.note}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Rarity — shown with real faces so the tiers read instantly. */}
      <motion.div {...stagger(STEPS.length + 2)} className="mt-10">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Some people are harder to find</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">
          Every sticker you pull rolls against these odds. The two legendaries are the holdup — expect around 20 packs
          to complete the whole album.
        </p>
        <div className="mt-5 flex justify-around gap-3 rounded-2xl bg-kraft p-5 ring-1 ring-edge">
          <RarityCard typeId={0} tierName="● Common" count="12 people" odds="70%" />
          <RarityCard typeId={12} tierName="◆ Rare" count="6 people" odds="25%" />
          <RarityCard typeId={18} tierName="✦ Legendary" count="2 people" odds="5%" />
        </div>
        <p className="mt-2 text-center text-xs text-ink-soft">Chance per sticker drawn.</p>
      </motion.div>

      {/* Quiet reveal-on-demand: it's real, on testnet. */}
      <motion.p {...stagger(STEPS.length + 3)} className="mt-10 max-w-prose text-sm text-ink-soft">
        Every coin, sticker, and trade here is a real transaction on the{" "}
        <span className="font-semibold text-ink">Stellar testnet</span> — backed by seven smart contracts. You don't
        need to think about any of that to play, but it's all really happening on-chain.
      </motion.p>

      {/* CTA adapts to whether you're already in. */}
      <motion.div {...stagger(STEPS.length + 4)} className="mt-8">
        {address ? (
          <Link
            to="/"
            className="inline-block rounded-full bg-leaf-deep px-7 py-3.5 font-display text-lg font-bold text-paper shadow-md transition hover:bg-leaf focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
          >
            Go to the counter →
          </Link>
        ) : (
          <button
            onClick={connect}
            disabled={!!busy}
            className="rounded-full bg-leaf-deep px-7 py-3.5 font-display text-lg font-bold text-paper shadow-md transition hover:bg-leaf focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:opacity-50"
          >
            {busy ? `${busy}…` : "Connect wallet to start"}
          </button>
        )}
      </motion.div>
    </Page>
  );
}
