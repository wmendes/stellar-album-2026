# Bootstrap & Deploy

This is where a multi-contract project actually breaks — not in the contract logic, but in the **deploy ordering and cross-contract authority wiring**. Read this before running anything.

## Workspace layout

A Cargo workspace, one crate per contract, plus an integration-test crate:

```
stellar-album/
├── Cargo.toml          # [workspace]
├── contracts/
│   ├── coin/
│   ├── faucet/
│   ├── sticker/
│   ├── pack/
│   ├── store/
│   ├── album/
│   └── escrow/
└── tests/              # integration tests (cross-contract, end-to-end)
```

Each crate compiles on its own. The `tests/` crate pulls in every contract's client and runs the full flows (faucet → store → pack → album → escrow).

## First command

```bash
stellar contract init stellar-album --name coin
```

This scaffolds the workspace plus the Class 1 contract (`coin`). Add the rest incrementally:

```bash
stellar contract init . --name faucet
stellar contract init . --name sticker
# ... etc
```

(Or copy the `coin/` crate as a template.)

## Build order

Build in dependency order. Each step compiles and runs before the next is added:

1. **Coin** (OZ `fungible` + Mintable) — base of everything.
2. **Faucet** — trivial, and unblocks testing the store without funding accounts by hand.
3. **Sticker** (hand-rolled multi-token) — the technical heart.
4. **Pack** (burn + 3× `env.prng()` → mint stickers).
5. **Store** (sells packs for Coin).
6. **Album** (soulbound; pasting burns a sticker).
7. **Escrow** (sticker↔sticker trade).

> Note: this **build order** (dependency-driven) differs slightly from the **teaching order** (concept-driven), which groups Pack + Album in Class 3. Each class's branch should compile in the order that class presents. See [curriculum](curriculum/).

## Deploy sequence & authority wiring

The authority graph (see [architecture.md](architecture.md#authority-graph)) requires a specific deploy order because of circular address dependencies. Example for Coin + Faucet:

```
1. deploy Coin
2. deploy Faucet(coin_addr)        # Faucet needs Coin's address at construction
3. coin.set_minter(faucet_addr)    # Coin learns its minter only after Faucet exists
```

The same pattern repeats across the graph:

```
deploy Sticker
deploy Pack(sticker_addr)   →  sticker.set_minter(pack_addr)
deploy Album(sticker_addr)  →  sticker.set_burner(album_addr)
deploy Store(coin_addr, pack_addr)  →  pack.set_minter(store_addr)
deploy Escrow(sticker_addr)
```

**Capture every deployed contract ID** as you go — later steps reference them.

### Caatinga deploy (recommended)

The full project is orchestrated by [Caatinga](https://github.com/caatinga-dev/caatinga) via `caatinga.config.ts` at the repository root. One command builds the workspace, deploys all seven contracts in dependency order, runs the four authority wiring invokes, generates TypeScript bindings, and writes `frontend/.env.local`:

```bash
# prerequisites: Node 22+, Rust, Stellar CLI, wasm32v1-none
npm install
caatinga setup --source deployer --network testnet   # first time only
make bootstrap                                       # runs: caatinga deploy --source deployer --network testnet
cd frontend && npm install && npm run dev
```

When deploying the **full contract graph** (no contract name argument), `caatinga deploy` automatically:
- Runs configured `postDeploy` wiring hooks (via `caatinga wire`)
- Generates TypeScript bindings
- Writes `frontend.envFile` (via `caatinga sync-env`)

Granular commands when you need them:

```bash
caatinga build
caatinga deploy --source deployer --network testnet
caatinga wire --source deployer --network testnet      # re-run wiring if skipped with --no-wire
caatinga generate --network testnet                   # regenerate bindings if needed
caatinga sync-env --network testnet                    # rewrite env file if needed
caatinga status --network testnet
```

Deploy args and `postDeploy` wiring live in `caatinga.config.ts` — the same steps that used to be in `bootstrap.sh`, now versioned as config instead of shell.

### Use a commented bootstrap script

Put all of this in `caatinga.config.ts` (`postDeploy` hooks) or, for teaching, a commented shell script with the `stellar contract invoke` calls in the correct order. We deliberately prefer visible wiring steps over an on-chain bootstrap contract because the script *shows the student every step* — and the wiring is exactly the cross-contract content the course teaches.

`bootstrap.sh` is deprecated; use `make bootstrap` or `caatinga deploy --source deployer --network testnet`.

This is the #1 place students hit `auth error` / `unreachable`. The integration-test crate should exercise each authority edge early so a missing `set_minter` fails in CI, not in a live class.

## Smoke test per class

Each class ends with a runnable "reproduce this" (see the [curriculum](curriculum/)). The bootstrap doc should list, per class, the minimal `stellar contract invoke` sequence that proves the day's contract works end-to-end — e.g. for Class 1: deploy Coin + Faucet, claim, observe balance, claim again before cooldown and see it fail.

## TTL & archival — a testnet gate, not a unit test

Sticker balances and Album slots live in **persistent** storage. The contracts call `extend_ttl` on every touch (helper + threshold consts in `contracts/test-utils`), but **the default Soroban test environment does not simulate archival/TTL expiry** — so a 100%-green `cargo test` does **not** prove archival safety.

TTL correctness is therefore a **testnet/deploy-gate checklist item**, not a CI assertion: deploy to testnet, let a persistent entry approach expiry, and confirm the extend behavior keeps it alive. Don't read green CI as archival-safe. See [implementation-plan.md](implementation-plan.md#hard-rule-2--ttl--archival-is-a-testnet-runtime-gate-not-a-unit-test) (Hard Rule 2).
