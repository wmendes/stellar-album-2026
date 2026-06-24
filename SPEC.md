# SPEC — Milestone `v0.5-hardening`

> **Spec-driven design** for the next milestone of `stellar-album`. Two
> **principal deliverables**, one PR each:
>
> 1. **PR-UPG — Upgradeable contracts** (the headline architectural fix).
> 2. **PR-RNG — Robust sticker randomness** (the headline mechanic fix).
>
> Every other improvement in this milestone (the self-transfer / self-accept
> security guards, address setters, events, deploy script, diagram) is a
> **collateral common fix** that rides along inside one of those two PRs as its
> own atomic commit — never a third headline. Each commit closes a checklist
> item so the diff stays reviewable.

- Product intent: [PRODUCT.md](PRODUCT.md) · Design system: [DESIGN.md](DESIGN.md)
- Architecture & authority graph: [docs/architecture.md](docs/architecture.md)
- Build method, Hard Rules, DoD: [docs/implementation-plan.md](docs/implementation-plan.md)
- Decision log (ADR): [docs/decisions.md](docs/decisions.md) — this milestone adds **D22–D27**.

---

## 1. Context

`main` ships the complete teaching system: 7 Soroban contracts, 45 tests, the
full [fungibility spectrum](docs/fungibility-spectrum.md) playable end-to-end
([implementation-plan](docs/implementation-plan.md) — all phases ✅). That was
the *correctness-and-curriculum* milestone. This one makes the system
**maintainable and fair**.

A review pass over the live contracts surfaced the two problems that define the
principal deliverables:

1. **Contracts are not upgradeable.** Fixing any deployed contract today means a
   full redeploy: new contract IDs, re-wiring the authority graph, and **loss of
   all persistent state** (every balance, album, and open offer). A one-line bug
   becomes a deploy-and-migration problem. → **PR-UPG**.
2. **Pack draws are grindable / weakly random.** `Pack.open` draws with
   `env.prng()`, which a caller can preview by simulation and re-roll for free by
   only submitting good results ([architecture.md](docs/architecture.md#pack)). →
   **PR-RNG**.

The same review also found a **balance-conservation bug** (`Sticker.transfer`
with `from == to` mints from nothing, amplified by `Escrow.accept_offer` when
`taker == maker`). These are real and exploitable — but rather than a third
headline, they ride into **PR-UPG** as collateral commons, because PR-UPG is the
contract-hardening pass and upgradeability is precisely *what lets a fix like
this ship without a redeploy*. (Atomic **commits** inside the PR keep them
reviewable — see [§7](#7-delivery--contribution-workflow).)

### The one rule that frames everything

> **The smart contract is the trust boundary, not the dApp.** Anyone can call a
> contract directly, bypassing the frontend. Every guard and gate in this spec
> is enforced **in the contract** and tested with selective `mock_auths`.

---

## 2. Goals & Non-Goals

### Principal goals

- **G1 (PR-UPG) — Upgradeable, maintainable contracts.** Stateful contracts gain
  an admin-gated upgrade path so future fixes preserve state instead of forcing
  redeploys. The collateral commons (security guards, setters, events, deploy,
  diagram) land in the same PR as atomic commits.
- **G2 (PR-RNG) — Fair pack draws.** Make the sticker draw resistant to grinding,
  shipped as an explicit, *taught* security upgrade (the attack + the mitigation
  are first-class course content, per [PRODUCT.md](PRODUCT.md)).

### Non-Goals (this milestone)

- **NG1 — No product / scope / design change.** The core loop, the 20-type
  catalog, the [economy](docs/economy-and-rarity.md), and [DESIGN.md](DESIGN.md)
  are untouched.
- **NG2 — Do NOT replace the wallet stack.** `@creit.tech/stellar-wallets-kit`
  **stays** as the wallet abstraction ([D22](#9-decision-log-additions-d22d27)).
  Any smart-account / passkey / sponsorship work is *additive* behind the
  existing `submit(tx)` helper and is **deferred** ([§10](#10-deferred--future-work)).
  We are not swapping in Blux, Dynamic, or any single-wallet SDK.
- **NG3 — No mainnet launch.** Target stays Stellar **testnet**.
- **NG4 — No new game mechanics.** Escrow stays 1-for-1; no Coin-for-sticker
  trades, no auctions ([architecture.md](docs/architecture.md#escrow)).

---

## 3. Definitions

| Term | Meaning in this spec |
|---|---|
| **Principal PR** | One of the two headline deliverables (PR-UPG, PR-RNG). |
| **Collateral common fix** | A small, shared correctness/infra fix that ships *inside* a principal PR as its own atomic commit — not a separate PR. |
| **Upgrade** | Replacing a deployed contract's wasm in place (`update_current_contract_wasm`) while keeping its address and persistent storage. |
| **Setter** | An admin-gated function that re-points a stored address (minter/burner/sticker/coin/treasury) after deploy. |
| **Grindable draw** | A `prng` outcome a caller can preview by simulation and re-roll for free by only submitting good results. |
| **Balance conservation** | For any `type_id`, the sum of all balances + escrow custody is invariant across a non-mint/non-burn op. The headline correctness invariant. |
| **Defensive guard** | A `require`/`panic` enforced inside the contract, independent of any frontend check. |

---

## 4. PR-UPG — Upgradeable contracts (principal)

**Theme:** make the contracts maintainable — upgradeable in place, reconfigurable,
observable, and free of the known balance bug. One PR, atomic commits.

### 4.1 Principal change

#### UPG-1 — Standard upgrade path for stateful contracts
- **Spec:** add an admin-gated `upgrade(new_wasm_hash: BytesN<32>)` to each
  hand-rolled stateful contract (**Sticker, Pack, Album, Store, Escrow, Faucet**)
  calling `e.deployer().update_current_contract_wasm(new_wasm_hash)` after
  `admin.require_auth()`. Centralize the helper + admin convention in
  `contracts/common` so all six share one audited implementation
  ([D23](#9-decision-log-additions-d22d27)). **Coin** wraps OZ `fungible`: use the
  OZ-recommended upgrade surface, or document why Coin stays non-upgradeable.
- **Acceptance:**
  - [ ] Each stateful contract exposes admin-only `upgrade`; non-admin call panics.
  - [ ] Integration test: deploy v1 → **write state** (mint a sticker / open an
        offer) → upgrade to a v2 wasm that adds a fn → **pre-upgrade state is
        still readable** through the same contract ID.
  - [ ] The `common` upgrade helper has its own unit coverage.

### 4.2 Collateral common fixes (atomic commits in this PR)

#### UPG-2 — Reconfigurable authority graph via setters
- **Spec:** extend the existing `Sticker.set_minter/set_burner` convention
  ([sticker/src/lib.rs:115](contracts/sticker/src/lib.rs:115)) to every
  cross-contract edge: `Pack.set_sticker` · `Store.set_coin/set_pack/set_treasury`
  · `Album.set_sticker` · `Escrow.set_sticker` · `Faucet.set_coin`. Constructor
  args stay the *initial* wiring; setters allow re-point after an upgrade or
  mis-wire without redeploy. Each setter is admin-gated, has a getter, and calls
  `extend_instance` (TTL convention, Hard Rule 2).
- **Acceptance:** non-admin setter panics; a re-pointed edge is used by a
  follow-up call (integration test).

#### SEC-1 — Reject sticker self-transfer *(collateral; motivates the whole PR)*
- **Site:** `Sticker.transfer` — [contracts/sticker/src/lib.rs:100](contracts/sticker/src/lib.rs:100).
- **Bug:** with `from == to`, `to_bal` is read *before* the debit; the credit
  write overwrites the debit on the same `Balance(owner, type)` key, leaving the
  holder at `balance + amount` — **stickers minted from nothing**, conservation
  broken.
- **Spec:** after `require_auth`/`require_valid`, reject equal endpoints:
  `if from == to { panic!("sticker: cannot transfer to self") }`. Reject (panic),
  don't no-op — a self-transfer is never legitimate here.
- **Acceptance:**
  - [ ] PoC test reproduces the inflation on current `main` (red first).
  - [ ] Post-guard self-transfer **panics**; balance + supply unchanged.
  - [ ] Normal `from != to` transfer unaffected (regression).
  - [ ] Enforced in the contract, not the frontend.

#### SEC-2 — Reject accepting your own escrow offer *(collateral)*
- **Site:** `Escrow.accept_offer` — [contracts/escrow/src/lib.rs:89](contracts/escrow/src/lib.rs:89).
- **Bug:** with `taker == offer.maker`, the `taker → maker` leg is a self-transfer
  of `want_type` and inherits SEC-1's duplication.
- **Spec:** after loading the offer, reject
  `if taker == offer.maker { panic!("escrow: cannot accept own offer") }`.
  **Independent of SEC-1** (defense in depth) so escrow stays correct even if
  `transfer` regresses.
- **Acceptance:**
  - [ ] PoC test reproduces the duplication on current `main` (red first).
  - [ ] Post-guard self-accept **panics**; custody + balances unchanged.
  - [ ] Two-distinct-user accept still swaps atomically (regression).
  - [ ] Guard does not depend on SEC-1.

#### OBS-1 — Structured events on every state change *(collateral)*
- **Spec:** emit a Soroban event from each mutation with a documented topic/data
  schema ([D24](#9-decision-log-additions-d22d27)). Minimum set:

  | Contract | Action | Topics | Data |
  |---|---|---|---|
  | Sticker | mint / burn / transfer | `("mint"\|"burn"\|"transfer", type_id)` | `(addr)` / `(from, to, amount)` |
  | Pack | open | `("open", owner)` | `(t0, t1, t2)` |
  | Faucet | claim | `("claim", addr)` | `amount` |
  | Store | buy_pack | `("buy", buyer)` | `price` |
  | Escrow | create / accept / cancel | `("offer_*", offer_id)` | offer fields |
  | Album | paste | `("paste", owner)` | `type_id` |

- **Acceptance:** each mutation publishes its event (asserted via `env.events()`);
  schema documented in [architecture.md](docs/architecture.md). The frontend
  `pack.open` reveal still reads drawn types from the **tx result**, not events.

#### DEP-1 — Bootstrap reflects upgradeable, setter-wired architecture *(collateral)*
- **Spec:** update [bootstrap.sh](bootstrap.sh) / `make bootstrap` so wiring uses
  the UPG-2 setters, and add a state-preserving **`make upgrade CONTRACT=…`** path
  (`install` new wasm → `upgrade(hash)`) that keeps the contract ID and its
  `frontend/.env.local` entry.
- **Acceptance:** fresh `make bootstrap` deploys + wires all 7 (four authority
  edges still verify); `make upgrade` re-installs wasm against the existing ID,
  state survives, `.env.local` unchanged.

#### DOC-1 — Architecture diagram (Mermaid) *(collateral)*
- **Spec:** add a Mermaid diagram to [architecture.md](docs/architecture.md): 7
  contracts, the authority graph (mint/burn/transfer edges), and OBS-1 events.
- **Acceptance:** renders on GitHub; matches the post-UPG wiring.

---

## 5. PR-RNG — Robust sticker randomness (principal)

**Theme:** make the pack draw fair. One PR.

#### RNG-1 — Harden the pack draw against grinding
- **Context:** `Pack.open` draws with `env.prng()` — **grindable**: simulate,
  inspect, submit only good rolls ([architecture.md](docs/architecture.md#pack)).
  A per-opener seed already lands on `main` (commit `43d47a7`); this targets the
  *grind* vector, not per-player independence.
- **Spec:** adopt a **commit-reveal** open — `commit_open(owner)` stores a
  block-bound commitment; `reveal_open(owner)` draws using a value the caller
  could not know at commit time, then mints — **or** record, with the trade-off
  written down, why the demo keeps the single-tx grindable open as a *taught*
  limitation ([D25](#9-decision-log-additions-d22d27)). The teaching value
  (showing the attack *and* the mitigation) is a first-class deliverable.
- **Acceptance:**
  - [ ] A test demonstrates the grind (seeded preview → previewable outcome) on
        the old path.
  - [ ] If commit-reveal ships: simulate-then-submit cannot change the revealed
        draw; the two-step flow is tested and reflected in
        [class-3](docs/curriculum/class-3-pack-album.md).
  - [ ] If deferred: the mitigation boundary + trade-off are recorded in
        [decisions.md](docs/decisions.md) and the curriculum.

#### RNG-2 — Distribution & curriculum coverage *(collateral commit in this PR)*
- **Spec:** unit-test the weighted distribution over many seeds (tier ratios stay
  ≈ 70/25/5 per [economy-and-rarity.md](docs/economy-and-rarity.md)); update the
  Class-3 randomness lab to the chosen posture.
- **Acceptance:** distribution test green; curriculum matches the shipped behavior.

---

## 6. Non-functional requirements

- **NFR-1 — Trust boundary in the contract.** Every guard/gate is on-chain and
  tested with **selective** `mock_auths` (Hard Rule 1).
- **NFR-2 — Balance conservation is a standing invariant** (Phase-7 convention);
  any sticker-movement change keeps "totals before == after" green.
- **NFR-3 — TTL discipline preserved.** New writes/setters call the `common` TTL
  helper; archival stays a **testnet runtime gate, not a unit test** (Hard Rule 2).
- **NFR-4 — State-preserving change.** Post-UPG-1, fixes ship as upgrades; a PR
  that would force a state-losing redeploy must justify it.
- **NFR-5 — Green gate unchanged.** `cargo fmt --check`, `clippy -D warnings`,
  `cargo test --workspace`, `stellar contract build` stay green; test count grows.
- **NFR-6 — No design/product drift.** [DESIGN.md](DESIGN.md) / [PRODUCT.md](PRODUCT.md)
  rules untouched.

---

## 7. Delivery & contribution workflow

Two principal PRs, each opened against one issue ([§8](#8-the-two-issues)).
Collateral commons are **atomic commits inside** their PR, each closing one
acceptance item — so a themed PR still reads as a clean, reviewable sequence.

- **Issue first** — the issue is the canonical record (context, problem, affected
  file/fn, cause, reproduce, impact, suggested fix, acceptance). See [§8](#8-the-two-issues).
- **PR body** — Summary · Closes #… · Changed (commit list) · Motivation · How to
  test (`cargo test` + names) · Evidence · Impact (contract/frontend/deploy/state)
  · Out of scope.
- **Review bar** — (1) solves exactly the issue; (2) every fix has a test for the
  case that failed; (3) clean diff, investigation notes live in the issue/PR, not
  in code; (4) collateral fixes are **separate commits**, not tangled into one
  diff; (5) defensive in the contract, not only the dApp.
- **Red-first for bugs** — SEC-1/SEC-2 commit a PoC test that fails on current
  `main` before the guard, then flips to assert the panic + conservation.

> **Standard in one line:** *the issue documents the problem; the PR solves it;
> review confirms the solution is tested, traceable, and noise-free.*

---

## 8. The two issues

These are the two issues the two principal PRs close. Full copy-paste bodies are
in [§8.1](#81-issue-1--pr-upg) and [§8.2](#82-issue-2--pr-rng).

| Issue | Title | Closed by | Carries (collateral) |
|---|---|---|---|
| **#A** | Contracts are not upgradeable — any fix forces a state-losing redeploy | **PR-UPG** | setters, SEC-1, SEC-2, events, deploy, diagram |
| **#B** | Pack sticker draw is grindable / weakly random | **PR-RNG** | distribution tests, curriculum |

### 8.1 Issue 1 — PR-UPG

```markdown
**Title:** Contracts are not upgradeable — any fix forces a state-losing redeploy
**Labels:** architecture, upgradeability, contract

## Context
All 7 contracts are live on testnet (`main`). A review pass found a real balance
bug (Sticker self-transfer) and immediately exposed a bigger problem: there is
no way to ship the fix without throwing away state.

## Problem
None of the contracts can be upgraded in place. Fixing a deployed contract means
deploy-from-scratch: new contract IDs, re-wiring the whole authority graph, and
loss of ALL persistent state (balances, albums, open offers). Wiring is also
constructor-final, so a single mis-wire is unrecoverable without redeploy.

## Affected
- contracts/{sticker,pack,album,store,escrow,faucet}/src/lib.rs (no `upgrade`)
- contracts/common (no shared upgrade/admin helper)
- Authority wiring is constructor-only (e.g. Pack/Store/Album/Escrow/Faucet)

## Likely cause
Initial design optimized for the teaching build order; upgradeability and
post-deploy reconfiguration were out of scope for v0.1–v0.4.

## Impact
- Any bugfix (incl. the known Sticker self-transfer duplication) currently
  requires a redeploy and loses user state.
- No post-deploy reconfiguration of the authority graph.
- No on-chain observability of state changes (events) for debugging/indexing.

## Suggested fix (this PR, atomic commits)
1. `common`: shared admin-gated `upgrade(wasm_hash)` helper.
2. Add `upgrade(...)` to Sticker, Pack, Album, Store, Escrow, Faucet
   (decide Coin/OZ separately).
3. Address setters across the authority graph (Pack/Store/Album/Escrow/Faucet).
4. Collateral fix — reject Sticker self-transfer (`from == to`).
5. Collateral fix — reject Escrow self-accept (`taker == maker`).
6. Emit events on all mutations (documented schema).
7. Bootstrap + `make upgrade CONTRACT=…` (state-preserving); Mermaid diagram.

## Acceptance
- [ ] Admin-only `upgrade` on all stateful contracts; non-admin panics
- [ ] Integration test: write state → upgrade → state still readable (same ID)
- [ ] Admin-only setters re-point edges; verified by integration test
- [ ] Sticker self-transfer rejected (PoC red first → panics; conservation holds)
- [ ] Escrow self-accept rejected (PoC red first → panics; custody intact)
- [ ] Events emitted + asserted; schema in docs/architecture.md
- [ ] `make upgrade` preserves state and contract IDs; .env.local unchanged
- [ ] Each item above is its own commit; gate green; no out-of-scope changes
```

### 8.2 Issue 2 — PR-RNG

```markdown
**Title:** Pack sticker draw is grindable / weakly random
**Labels:** security, randomness, contract:pack, curriculum

## Context
`Pack.open` is the centerpiece mechanic: it draws 3 sticker types and cross-mints
them. It runs in a single transaction using `env.prng()`.

## Problem
The draw is grindable. A caller can SIMULATE `open`, read the result, and only
SUBMIT when the roll is good — a free re-roll for rares/legendaries. The outcome
is decided by values the submitter can preview, so "random" is effectively
chooseable.

## Affected
- contracts/pack/src/lib.rs → `open` (env.prng draw)
- common::type_for_roll (weighted mapping; correct, not the issue)

## Likely cause
Single-tx `env.prng()` draw: the result is knowable at simulation time, before
the user commits to submitting.

## How to reproduce
1. Hold a pack. 2. Simulate `open` and inspect the returned 3 types.
3. If not legendary, discard; re-simulate until good; only then submit.

## Impact
- Rarity economy (≈70/25/5) is bypassable by grinding → unfair distribution.
- Undermines the "semi-fungible by luck" lesson with a trivial exploit.

## Suggested fix (this PR)
- Commit-reveal: `commit_open(owner)` stores a block-bound commitment;
  `reveal_open(owner)` draws from a value unknowable at commit time, then mints.
- OR: deliberately keep the single-tx open as a TAUGHT limitation, with the
  trade-off + mitigation boundary recorded in docs/decisions.md and the Class-3
  randomness lab. (Decision D25.)
- Either way: keep per-opener seed independence (commit 43d47a7) and the weighted
  distribution.

## Acceptance
- [ ] Test demonstrates the grind on the current single-tx path
- [ ] Chosen posture implemented (commit-reveal) OR documented (taught limitation)
- [ ] If commit-reveal: simulate-then-submit cannot change the revealed draw
- [ ] Distribution test: tier ratios stay ≈ 70/25/5 over many seeds
- [ ] Class-3 curriculum updated to the shipped behavior
- [ ] Gate green; no out-of-scope changes
```

---

## 9. Decision log additions (D22–D27)

To append to [docs/decisions.md](docs/decisions.md) (ADR style, continuing D21):

- **D22 — Keep Stellar Wallets Kit** as the wallet abstraction; smart-account /
  sponsorship work is additive behind `submit(tx)` and deferred (NG2).
- **D23 — Upgradeability standard:** shared `common` admin-gated `upgrade(hash)`
  for hand-rolled contracts; Coin/OZ surface decided in UPG-1.
- **D24 — Event schema** (OBS-1); events are additive observability, not a
  read-path dependency.
- **D25 — Randomness posture:** commit-reveal vs. taught-grindable trade-off,
  recorded explicitly (RNG-1).
- **D26 — Setters over constructor-final wiring** (UPG-2).
- **D27 — Self-transfer / self-accept rejected on-chain** (SEC-1/SEC-2), shipped
  as collateral commits inside PR-UPG.

---

## 10. Deferred / future work

- **Smart accounts / passkeys + fee sponsorship** (Launchtube / OZ relayer)
  behind `submit(tx)`, Wallets Kit retained (D22). Design only; not this milestone.
- **Mainnet** fee strategy and launch.

---

## 11. Open questions

- **OQ-1 (UPG-1):** Upgrade *all six* hand-rolled contracts, or only the
  fix-likely ones (Sticker, Escrow) — keeping "some contracts are immutable on
  purpose" as a teaching point?
- **OQ-2 (UPG-1):** Does `upgrade` need a storage-migration hook, or do we
  constrain v0.5 upgrades to **additive** schema only?
- **OQ-3 (RNG-1):** Does commit-reveal's two-tx UX hurt the "pack-rip is the
  lesson" moment enough to prefer the documented-limitation path for the course?
- **OQ-4 (PR-UPG size):** Bundling SEC-1/SEC-2 as collateral commits trades PR
  atomicity for thematic cohesion. Acceptable here (atomic *commits*), or split
  the security guards into their own tiny PR after all?
```
