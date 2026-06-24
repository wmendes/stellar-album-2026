#![no_std]
//! Shared runtime helpers for stellar-album contracts.
//!
//! The TTL / archival convention lives here so every contract bumps persistent
//! and instance storage the same way. This is runtime contract code (compiles to
//! wasm) — distinct from the dev-only `test-utils` crate.
//!
//! Note: the default Soroban test env does NOT simulate archival, so calling
//! these helpers cannot be proven "archival-safe" by unit tests. That is a
//! testnet/deploy gate — see docs/implementation-plan.md (Hard Rule 2).

use soroban_sdk::{Address, BytesN, Env, IntoVal, Val};

/// Ledgers per day at ~5s close time.
pub const DAY_IN_LEDGERS: u32 = 17_280;

/// Persistent entries: extend when fewer than this many ledgers remain...
pub const PERSISTENT_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
/// ...and extend their life to this many ledgers.
pub const PERSISTENT_EXTEND_TO: u32 = 60 * DAY_IN_LEDGERS;

/// Instance storage: extend when fewer than this many ledgers remain...
pub const INSTANCE_THRESHOLD: u32 = 14 * DAY_IN_LEDGERS;
/// ...and extend its life to this many ledgers.
pub const INSTANCE_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;

/// Bump the TTL of a persistent storage entry. Call on every touch of a
/// persistent key (balances, album slots, offers).
pub fn extend_persistent<K>(env: &Env, key: &K)
where
    K: IntoVal<Env, Val>,
{
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_THRESHOLD, PERSISTENT_EXTEND_TO);
}

/// Bump the TTL of the contract's instance storage (config: admin, minter, etc.).
pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_EXTEND_TO);
}

// ---------------------------------------------------------------------------
// Upgrade convention
//
// Contracts are deployed without upgradeability in v0.1–v0.4, so fixing a bug
// meant a full redeploy: new contract id, re-wired authority graph, and lost
// persistent state. This shared helper gives every contract one audited,
// admin-gated, in-place upgrade path. The contract id and all storage (instance
// + persistent) survive the swap — only the code changes. See docs/decisions.md
// D24 and SPEC.md (PR-UPG / UPG-1).
// ---------------------------------------------------------------------------

/// Admin-gated, in-place wasm upgrade. The caller passes its stored `admin`;
/// this requires that admin's auth, then replaces the *current* contract's wasm
/// with `new_wasm_hash` (which must already be installed on the network). State
/// is preserved — this swaps code, not storage.
pub fn upgrade(env: &Env, admin: &Address, new_wasm_hash: BytesN<32>) {
    admin.require_auth();
    env.deployer().update_current_contract_wasm(new_wasm_hash);
}

// ---------------------------------------------------------------------------
// Sticker catalog
//
// The 20 SDF-professional sticker types and their rarity. Lives here (not in a
// contract) so both Sticker (Phase 3, validation) and Pack (Phase 4, weighted
// draw) can use it without depending on each other's cdylib.
// ---------------------------------------------------------------------------

/// Number of distinct sticker types. Valid `type_id`s are `0..TYPE_COUNT`.
pub const TYPE_COUNT: u32 = 20;

/// Rarity tier of a sticker type.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tier {
    Common,
    Rare,
    Legendary,
}

/// Tier of a type id. Layout: 0–11 common, 12–17 rare, 18–19 legendary.
pub fn tier(type_id: u32) -> Tier {
    match type_id {
        0..=11 => Tier::Common,
        12..=17 => Tier::Rare,
        _ => Tier::Legendary,
    }
}

/// Draw weight of a type id. Per-type weights chosen so the tier totals are
/// 70 / 25 / 5 (common / rare / legendary): 12×70 + 6×50 + 2×30 = 1200.
pub fn weight(type_id: u32) -> u32 {
    match tier(type_id) {
        Tier::Common => 70,
        Tier::Rare => 50,
        Tier::Legendary => 30,
    }
}

/// Sum of all type weights — the range a pack draw rolls within.
pub const TOTAL_WEIGHT: u32 = 1200;

/// Whether a type id refers to a real sticker.
pub fn is_valid_type(type_id: u32) -> bool {
    type_id < TYPE_COUNT
}

/// Map a draw roll in `0..TOTAL_WEIGHT` to a sticker type via cumulative
/// weights. Pure (no PRNG) so the rarity table can be tested deterministically,
/// separately from the randomness source. Pack feeds it `prng().u64_in_range`.
pub fn type_for_roll(roll: u64) -> u32 {
    let mut acc: u64 = 0;
    let mut t: u32 = 0;
    while t < TYPE_COUNT {
        acc += weight(t) as u64;
        if roll < acc {
            return t;
        }
        t += 1;
    }
    TYPE_COUNT - 1
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn weights_sum_to_total() {
        let sum: u32 = (0..TYPE_COUNT).map(weight).sum();
        assert_eq!(sum, TOTAL_WEIGHT);
    }

    #[test]
    fn roll_boundaries_map_to_expected_types() {
        assert_eq!(type_for_roll(0), 0); // first common
        assert_eq!(type_for_roll(69), 0); // end of first common's band
        assert_eq!(type_for_roll(70), 1); // second common
        assert_eq!(type_for_roll(840), 12); // first rare
        assert_eq!(type_for_roll(1140), 18); // first legendary
        assert_eq!(type_for_roll(TOTAL_WEIGHT as u64 - 1), 19); // last legendary
    }

    #[test]
    fn every_roll_yields_a_valid_type() {
        for roll in 0..TOTAL_WEIGHT as u64 {
            assert!(is_valid_type(type_for_roll(roll)));
        }
    }

    #[test]
    fn tiers_are_laid_out_as_documented() {
        assert_eq!(tier(11), Tier::Common);
        assert_eq!(tier(12), Tier::Rare);
        assert_eq!(tier(17), Tier::Rare);
        assert_eq!(tier(18), Tier::Legendary);
    }
}
