#![no_std]
//! Faucet — the Coin tap (Class 1).
//!
//! Mints Coin to a claimer. The **first** claim grants a generous onboarding
//! seed (so a class never stalls for lack of currency); **later** claims grant
//! a smaller drip and are gated by a cooldown enforced with the ledger
//! timestamp. The Faucet is wired as Coin's minter at deploy (`set_minter`),
//! which is the first cross-contract authority edge (Hard Rule 1 / D12).
//!
//! The cooldown is a constructor parameter: short in a live classroom, long in
//! a self-paced campaign (see docs/economy-and-rarity.md).

use soroban_sdk::{contract, contractclient, contractimpl, contracttype, Address, BytesN, Env};

/// Minimal view of the Coin contract the Faucet needs to call. Declaring the
/// interface locally (rather than depending on the `coin` cdylib crate) avoids
/// a wasm symbol collision on `__constructor`.
#[contractclient(name = "CoinMint")]
pub trait CoinInterface {
    fn mint(env: Env, to: Address, amount: i128);
}

#[contracttype]
enum DataKey {
    /// May repoint the Coin address and authorize upgrades.
    Admin,
    /// Address of the Coin contract this faucet mints.
    Coin,
    /// Seconds that must elapse between repeat claims.
    Cooldown,
    /// Amount granted on a claimer's first ever claim.
    Seed,
    /// Amount granted on every subsequent claim.
    Drip,
    /// Last claim timestamp per address.
    LastClaim(Address),
}

#[contract]
pub struct Faucet;

#[contractimpl]
impl Faucet {
    pub fn __constructor(
        e: &Env,
        admin: Address,
        coin: Address,
        cooldown: u64,
        seed: i128,
        drip: i128,
    ) {
        let s = e.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Coin, &coin);
        s.set(&DataKey::Cooldown, &cooldown);
        s.set(&DataKey::Seed, &seed);
        s.set(&DataKey::Drip, &drip);
    }

    /// Claim Coin. Returns the amount granted.
    ///
    /// First claim → onboarding `seed`. Later claims → `drip`, and only after
    /// `cooldown` seconds have elapsed since the previous claim (else it traps).
    pub fn claim(e: &Env, claimer: Address) -> i128 {
        claimer.require_auth();

        let now = e.ledger().timestamp();
        let key = DataKey::LastClaim(claimer.clone());
        let last: Option<u64> = e.storage().persistent().get(&key);

        let amount = match last {
            None => Self::seed(e),
            Some(last_ts) => {
                if now - last_ts < Self::cooldown(e) {
                    panic!("faucet: cooldown not elapsed");
                }
                Self::drip(e)
            }
        };

        CoinMint::new(e, &Self::coin(e)).mint(&claimer, &amount);

        e.storage().persistent().set(&key, &now);
        common::extend_persistent(e, &key);
        common::extend_instance(e);
        amount
    }

    pub fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn coin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Coin).unwrap()
    }

    pub fn cooldown(e: &Env) -> u64 {
        e.storage().instance().get(&DataKey::Cooldown).unwrap()
    }

    pub fn seed(e: &Env) -> i128 {
        e.storage().instance().get(&DataKey::Seed).unwrap()
    }

    pub fn drip(e: &Env) -> i128 {
        e.storage().instance().get(&DataKey::Drip).unwrap()
    }

    /// Unix timestamp of `claimer`'s last claim (0 if never claimed). The UI
    /// uses this + `cooldown` to show when the next claim is available.
    pub fn last_claim(e: &Env, claimer: Address) -> u64 {
        e.storage()
            .persistent()
            .get(&DataKey::LastClaim(claimer))
            .unwrap_or(0)
    }

    // --- admin ---

    /// Repoint the Coin contract this faucet mints. Admin only.
    pub fn set_coin(e: &Env, new_coin: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Coin, &new_coin);
        common::extend_instance(e);
    }

    /// Replace this contract's wasm in place. Admin only.
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        common::upgrade(e, &Self::admin(e), new_wasm_hash);
    }
}

#[cfg(test)]
mod test;
