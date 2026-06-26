import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { Page, CounterButton, Toast } from "../components/ui";
import { PackReveal } from "../components/PackReveal";

function fmtRemaining(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.max(0, Math.floor(sec % 60));
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${Math.max(1, s)}s`;
}

export default function Shop() {
  const { coin, packs, claimAt, busy, error, claim, buy, open, reveal, opening, dismissReveal, clearError, retryFn } = useStore();
  const navigate = useNavigate();
  const now = Date.now() / 1000;
  const claimReady = claimAt === 0 || now >= claimAt;

  // Tick once a second while the faucet is cooling down so the countdown is live
  // and the Claim button re-enables itself the moment it expires.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (claimReady) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [claimReady, claimAt]);

  const canOpen = !busy && packs >= 1;
  const firstRun = coin < 100 && packs === 0;
  const remaining = claimReady ? null : fmtRemaining(claimAt - now);

  return (
    <Page>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">The counter</h1>
      <p className="mt-1 max-w-prose text-sm text-ink-soft">
        Your coins are fungible: any one is worth any other. A sealed pack is fungible too, until you rip it open and it
        becomes three specific stickers.
      </p>

      {firstRun && (
        <div className="mt-5 flex flex-col gap-2 rounded-2xl bg-leaf-tint p-4 ring-1 ring-leaf/30 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-leaf-deep">
            {claimReady ? "👋 New here? Claim free coins, then buy your first pack." : `Coins are on cooldown — back in ${remaining}.`}
          </p>
          {claimReady && (
            <button onClick={claim} disabled={!!busy} className="shrink-0 rounded-full bg-leaf-deep px-5 py-2 text-sm font-bold text-paper shadow-md transition hover:bg-leaf focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:opacity-40">
              Claim free coins
            </button>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-kraft p-3 ring-1 ring-edge sm:flex-row">
        <div className="flex flex-1 gap-2">
          <CounterButton title="Claim coins" sub={claimReady ? "free from the faucet" : `ready in ${remaining}`} onClick={claim} disabled={!!busy || !claimReady} />
          <CounterButton title="Buy a pack" sub="100 ⭐" onClick={buy} disabled={!!busy || coin < 100} />
        </div>

        <button
          onClick={open}
          disabled={!canOpen}
          className="rounded-xl bg-leaf-deep px-6 py-4 font-display text-lg font-bold text-paper shadow-md transition hover:bg-leaf focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:opacity-40 disabled:shadow-none sm:min-w-[38%]"
        >
          {packs > 0 ? `Rip a pack · ${packs}` : "No packs to open"}
        </button>
      </div>

      <Toast busy={busy} error={error} onDismiss={clearError} onRetry={retryFn} />

      {(opening || reveal) && (
        <PackReveal
          reveal={reveal}
          count={1}
          onDismiss={dismissReveal}
          onOpenNext={packs >= 1 ? () => open() : undefined}
          onGoCollection={() => {
            dismissReveal();
            navigate("/collection");
          }}
        />
      )}
    </Page>
  );
}
