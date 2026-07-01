# Frontend & Testnet

How the built contracts become something a user can click. Decisions: [D18–D21](decisions.md).

## Goal

> On testnet: connect a wallet, claim Coin, buy a Pack, open it, and see 3 stickers revealed with rarity — start to finish, under 2 minutes.

That single path demonstrates the whole [fungibility spectrum](fungibility-spectrum.md).

## Stack

- **Vite + React + TypeScript + Tailwind** — client-only; all reads/writes against Soroban RPC.
- **Generated bindings** — `stellar contract bindings typescript` per deployed contract → a typed client (`pack.open` → `AssembledTransaction<Array<u32>>`). No hand-written XDR.
- **`@stellar/stellar-sdk`** — the engine under the bindings (simulate / sign / send / poll).
- **Wallet** — `@creit.tech/stellar-wallets-kit` with all no-config browser wallets enabled (`allowAllModules()`: Freighter, xBull, Lobstr, Albedo, Rabet, Hana, …). The selected wallet id is persisted to `localStorage` and silently restored on load, so a page refresh keeps the session (no keys are stored).

## Testnet deployment (`caatinga deploy` → `make bootstrap`)

Contracts have circular address deps, so deploy first, then wire authority edges. Caatinga orchestrates the full flow from `caatinga.config.ts`:

```bash
make bootstrap   # caatinga deploy --source deployer --network testnet
```

When deploying the **full contract graph** (no contract name argument), `caatinga deploy` automatically:
- Runs configured `postDeploy` wiring hooks (via `caatinga wire`)
- Generates TypeScript bindings
- Writes `frontend.envFile` (via `caatinga sync-env`)

Steps performed:

1. **Keys** — generate + friendbot-fund a `deployer` (admin/treasury for all contracts).
2. **Build** — `stellar contract build` → wasms in `target/wasm32v1-none/release/`.
3. **Deploy (7)** — `stellar contract deploy` each, passing constructor args (admin, and any already-deployed addresses), capturing each contract ID.
4. **Wire (4 edges)** — admin-signed `set_minter`/`set_burner` (via `postDeploy` hooks):
   - `coin.set_minter(faucet)` · `pack.set_minter(store)` · `sticker.set_minter(pack)` · `sticker.set_burner(album)`
   - Escrow needs no role — sticker↔sticker custody uses `transfer` with the owner's auth.
5. **Emit config** — write `frontend/.env.local` with the 7 IDs + network (via `sync-env`):
   ```
   VITE_COIN=… VITE_FAUCET=… VITE_STICKER=… VITE_PACK=… VITE_ALBUM=… VITE_STORE=… VITE_ESCROW=…
   VITE_RPC_URL=https://soroban-testnet.stellar.org
   VITE_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
   ```

**Gotchas:** the wiring calls are admin-gated — use the same `deployer` key that constructed them. All four edges must be wired before the frontend opens (claim needs Coin's minter set; buy needs Pack's; open needs Sticker's). Deploy with a short faucet cooldown for demoing.

## Fees / funding

Intent: **the user never touches XLM.** v1 meets this with **friendbot auto-fund on connect** (`ensureFunded(pubkey)` — check the account via RPC, friendbot it if missing, then unlock actions). No fee-sponsorship backend.

**Later (mainnet / passkeys):** real fee sponsorship via **Launchtube** or an **OpenZeppelin relayer**. All submission goes through one `submit(tx)` helper today (sign with the wallet, then submit) so swapping in a relay later is a contained change, not a rewrite. See [D20](decisions.md).

## TTL / archival

Out of scope for a test session — testnet persistent entries get a generous default TTL. If a deployment sits idle for weeks, re-bootstrap rather than building bump logic. (The contract-side `extend_ttl` convention is already in place; verification is a deploy-gate, not a unit test — Hard Rule 2 in [implementation-plan.md](implementation-plan.md).)

## v1 build order (mirrors the contract phases)

1. **Connect + balance** — wallet connect, `ensureFunded`, read `coin.balance` (proves bindings + RPC).
2. **Claim** — `faucet.claim` (proves the full sign → send → poll loop).
3. **Buy** — `store.buy_pack` (spend 100 Coin).
4. **Open + reveal** — `pack.open` returns the 3 drawn types in the tx result; reveal rarity + type. **The reveal is the payoff** — fire the tx and start the rip animation together, hold cards face-down during confirmation (~5s testnet ledger), flip on success. No spinner. *Correct first (3 stickers, right rarity, from chain), choreography second.*

**v2 (built):** Album view + paste, and a visual **Escrow marketplace** — every open offer is listed with give↔want sticker faces and a one-click accept (no offer-number typing). This relies on escrow read methods added after the original design: `offers() -> Vec<OfferView>` and `get_offer(id)` (see [architecture.md](architecture.md#escrow)).

## The reveal data path (confirmed)

`Pack.open` returns `Vec<u32>` (the 3 drawn type ids) **directly in the transaction result** — no second read needed. The reveal can flip the instant the tx confirms. Rarity is derived from the type id via the shared catalog (`common::tier`). Serial numbers are not modeled (D16).
