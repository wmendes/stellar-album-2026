import { AnimatePresence, MotionConfig } from "framer-motion";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useStore } from "./store";
import Shop from "./pages/Shop";
import Collection from "./pages/Collection";
import Album from "./pages/Album";
import Trade from "./pages/Trade";
import Guide from "./pages/Guide";

const NAV = [
  { to: "/", label: "Shop", end: true },
  { to: "/collection", label: "Collection" },
  { to: "/album", label: "Album" },
  { to: "/trade", label: "Trade" },
  { to: "/guide", label: "How it works" },
];

export default function App() {
  const { address, coin, packs, connect, busy, error } = useStore();
  const location = useLocation();
  const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative z-10 min-h-screen">
        <header className="sticky top-0 z-30 border-b border-edge bg-kraft">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-y-2 px-5 py-3">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-extrabold tracking-tight text-ink">Stellar Album</span>
              <span className="text-leaf">✦</span>
            </div>

            {address && (
              <>
                <nav className="order-3 flex w-full gap-1 sm:order-2 sm:w-auto">
                  {NAV.map((n) => (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      end={n.end}
                      className={({ isActive }) =>
                        `rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                          isActive ? "bg-leaf-deep text-paper" : "text-ink-soft hover:bg-paper"
                        }`
                      }
                    >
                      {n.label}
                    </NavLink>
                  ))}
                </nav>
                <div className="order-2 flex items-center gap-2 text-sm sm:order-3">
                  <span className="rounded-full bg-leaf-tint px-3 py-1 font-display font-bold text-leaf-deep">{coin} ⭐</span>
                  <span className="rounded-full bg-paper px-3 py-1 text-ink-soft ring-1 ring-edge">{packs} {packs === 1 ? "pack" : "packs"}</span>
                  <span className="hidden font-mono text-xs text-ink-soft lg:inline">{short(address)}</span>
                </div>
              </>
            )}
          </div>
        </header>

        {!address ? (
          <Routes location={location} key={location.pathname}>
            <Route path="/guide" element={<Guide />} />
            <Route path="*" element={<Landing connect={connect} busy={busy} error={error} />} />
          </Routes>
        ) : (
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Shop />} />
              <Route path="/collection" element={<Collection />} />
              <Route path="/album" element={<Album />} />
              <Route path="/trade" element={<Trade />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="*" element={<Shop />} />
            </Routes>
          </AnimatePresence>
        )}
      </div>
    </MotionConfig>
  );
}

function Landing({ connect, busy, error }: { connect: () => void; busy?: string; error?: string }) {
  return (
    <section className="mx-auto max-w-xl px-6 py-20 text-center">
      <div className="mx-auto mb-10 grid h-44 w-36 place-items-center rounded-3xl bg-leaf-deep legendary-foil shadow-xl" style={{ transform: "rotate(-6deg)" }}>
        <span className="font-display text-2xl font-extrabold tracking-wide text-paper">PACK</span>
      </div>
      <h1 className="font-display text-4xl font-extrabold leading-tight text-ink sm:text-5xl">Collect the people who build Stellar.</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-soft">Claim coins, rip open packs of SDF stickers, press your favourites into a soulbound album, and swap your doubles. Live on Stellar testnet.</p>
      <button onClick={connect} disabled={!!busy} className="mt-8 rounded-full bg-leaf-deep px-7 py-3.5 font-display text-lg font-bold text-paper shadow-md transition hover:bg-leaf focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:opacity-50">
        {busy ? `${busy}…` : "Connect wallet to start"}
      </button>
      <p className="mt-3 text-xs text-ink-soft">Freighter, xBull, Lobstr, Albedo & more — on Testnet. We fund your account for you, no XLM needed.</p>
      <p className="mt-5 text-sm">
        <NavLink to="/guide" className="font-semibold text-leaf-deep underline-offset-4 hover:underline">New here? See how it works →</NavLink>
      </p>
      {error && <p className="mx-auto mt-5 max-w-md rounded-xl bg-paper px-4 py-3 text-sm text-ink ring-1 ring-edge">{error}</p>}
    </section>
  );
}
