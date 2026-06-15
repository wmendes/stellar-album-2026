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

use soroban_sdk::{Env, IntoVal, Val};

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
