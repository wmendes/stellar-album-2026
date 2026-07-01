#![no_std]
//! Coin — the pure-fungible in-game currency (Class 1).
//!
//! Wraps the OpenZeppelin `fungible` Base (balances, transfer, supply, metadata)
//! and adds a hand-rolled admin/minter so the **authority-edge convention**
//! (docs/implementation-plan.md, Hard Rule 1 / decision D12) is explicit:
//! `mint` is gated to a *settable* minter address, which the Faucet becomes in
//! Phase 2. Unit tests point the minter at a test address; the integration test
//! rewires it to the real Faucet contract.

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, BytesN, Env, MuxedAddress, String,
};
use stellar_tokens::fungible::{Base, FungibleToken};

#[contracttype]
enum DataKey {
    /// May repoint the minter. Set once at construction.
    Admin,
    /// The only address allowed to `mint` (the Faucet, once wired).
    Minter,
}

#[contract]
pub struct Coin;

#[contractimpl]
impl Coin {
    pub fn __constructor(e: &Env, admin: Address, minter: Address) {
        Base::set_metadata(
            e,
            7,
            String::from_str(e, "Stellar Album Coin"),
            String::from_str(e, "ALBUM"),
        );
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Minter, &minter);
    }

    /// The address allowed to repoint the minter.
    pub fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// The address allowed to mint.
    pub fn minter(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Minter).unwrap()
    }

    /// Repoint the minter. Admin-gated — this is the bootstrap step that wires
    /// the Faucet as Coin's minter on deploy.
    pub fn set_minter(e: &Env, new_minter: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Minter, &new_minter);
        common::extend_instance(e);
    }

    /// Mint new Coin to `to`. Only the configured minter may call.
    pub fn mint(e: &Env, to: Address, amount: i128) {
        Self::minter(e).require_auth();
        Base::mint(e, &to, amount);
        common::extend_instance(e);
    }

    /// Replace this contract's wasm in place. Admin only.
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        common::upgrade(e, &Self::admin(e), new_wasm_hash);
    }
}

// `contracttrait` exports the trait's default method bodies (balance, transfer,
// total_supply, metadata, …) as contract entrypoints, delegating to `Base`.
#[contractimpl(contracttrait)]
impl FungibleToken for Coin {
    type ContractType = Base;
}

#[cfg(test)]
mod test;
