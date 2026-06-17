# Case: Sticker self-transfer duplication (infinite mint, single wallet)

## Hand-off Brief (15s read)
`Sticker::transfer` reads both balances before writing both. When `from == to`,
the second write clobbers the first, so a wallet that sends a sticker **to itself**
ends up with `balance + amount` instead of `balance`. Any holder can double any
sticker type — including legendaries — from a single wallet, with no second wallet
and no Pack/Store/Coin involved. This is a different vector from the known
multi-wallet faucet abuse.

## Case Info
- Slug: sticker-self-transfer-mint
- Status: Active (root cause Confirmed; PoC + adversarial refutation in flight)
- Scope: `contracts/sticker/src/lib.rs`

## Problem Statement
Creator reports a critical bug, explicitly NOT the "multiple wallets → infinite
mint" faucet abuse. Find the real vulnerability.

## Confirmed Findings
- `contracts/sticker/src/lib.rs:99-111` — `transfer(from, to, sticker_type, amount)`:
  - `from_bal` read at :103, `to_bal` read at :107, then `set_balance(from, from_bal-amount)` at :108 and `set_balance(to, to_bal+amount)` at :109.
  - No `from == to` guard. `require_valid` (:129) only checks type validity + `amount > 0`.
- `contracts/sticker/src/test.rs:46-60` — the only transfer test uses distinct
  alice/bob; self-transfer is untested. No guard anywhere (grep: 0 hits).

## Deduced Conclusions
- With `from == to`: both reads return `X`; write order leaves `to_bal + amount = X + amount`.
- Exploit: hold ≥1 of any type → `transfer(me, me, type, balance)` doubles it.
  Repeat for exponential growth (1→2→4→8…). Works on legendaries (type 18/19).
- `supply` is not updated by `transfer`, so post-exploit `balance > supply`
  (accounting invariant broken; album completion / trade market trivially gamed).

## Impact
- Critical / economic-break: defeats rarity, album scarcity, and the escrow trade
  market. Reachable by any user holding a single sticker; callable directly on the
  contract regardless of frontend.

## Fix direction (out of scope to implement until confirmed)
- Add an early `if from == to { return; }` (or trap) in `transfer`, OR
- Compute against a single in-memory balance map / update `from` then re-read `to`,
  OR follow the OZ fungible pattern (the Coin contract delegates to a library that
  handles self-transfer correctly — only the hand-rolled multi-token is affected).

## Verification (DONE — root cause Confirmed, High confidence)
- PoC unit test passed (`cargo test -p sticker`, exit 0): mint 1 → self-transfer 1
  → balance **2** → self-transfer 2 → balance **4**, supply pinned at **1**.
  (Test + snapshot reverted; tree clean.)
- Workflow `album-critical-bug-audit`: **3/3 independent refuters returned
  claim_holds=true**; two re-ran the PoC; one verified soroban-sdk 26.1.0 storage
  semantics = transaction-local map, read-after-write, **last-write-wins** → the
  second `set` (X+amount) clobbers the first (X−amount). Refutation failed on every
  prong (auth, validation, key aliasing, host de-dup, snapshot-at-entry).

## Second exploitation path of the SAME root cause (Confirmed)
- `contracts/escrow/src/lib.rs:89-104` — `accept_offer` has **no `taker != maker`
  guard and no `give_type != want_type` guard** (grep: NONE). Accepting your own
  offer makes leg 2 `transfer(taker → maker, …)` a **self-transfer**, which trips
  the exact Sticker bug and duplicates a sticker out of custody (agent PoC: maker
  ends with 2 vs supply 1). Implication: the fix MUST live in `sticker::transfer`
  (guarding only the raw entrypoint is insufficient — Escrow re-exposes it). Escrow
  should also add `taker != maker` / `give != want` sanity guards.

## Other areas swept (no NEW critical bug)
- store-coin, faucet, album-common, frontend: clean.
- pack: the sweep flagged that draws have **zero per-address/ledger entropy**
  (`seed = sha256(nonce)`, nonce starts at 0 per address) → outcomes globally
  identical & precomputable. This is real but is the **already-documented** known
  limitation (lib.rs:92-93, decisions D22: determinism is required so the sim
  footprint matches execution). Not the critical bug; worth hardening (mix
  `opener` into the seed — safe, since the address is known at simulation time).

## Final Conclusion
**Root cause: `Sticker::transfer` (sticker/src/lib.rs:99-111) reads both balances
before writing both; with `from == to` the later write wins, fabricating `amount`
stickers.** Single wallet, no Pack/Store/Faucet, compounds exponentially, reachable
directly and via Escrow self-accept. Confidence: **High** (deterministic PoC repro +
3 independent refutations + verified host storage semantics).

## Fix (1 line, plus a defensive escrow guard)
```rust
// sticker/src/lib.rs, top of transfer(), after require_valid:
if from == to { return; }            // self-transfer is a no-op
```
```rust
// escrow/src/lib.rs, in accept_offer(), after loading the offer:
if taker == offer.maker { panic!("escrow: cannot accept own offer"); }
```
Status: **Concluded.**
