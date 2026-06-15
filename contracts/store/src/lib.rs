#![no_std]
//! Store — buy sealed packs with Coin (Class 4).
//!
//! Closes the economic loop: the fungible Coin buys the fungible sealed pack.
//! `buy_pack` pulls the price from the buyer (to the treasury) and mints one
//! pack to them. It composes the whole left half of the graph:
//! Coin (pay) + Pack (mint), with the Store as Pack's minter.

use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, Address, Env, MuxedAddress,
};

/// Coin payment interface (declared locally to avoid the cdylib dependency).
#[contractclient(name = "CoinPay")]
pub trait CoinInterface {
    fn transfer(env: Env, from: Address, to: MuxedAddress, amount: i128);
}

/// Pack mint interface (declared locally to avoid the cdylib dependency).
#[contractclient(name = "PackMint")]
pub trait PackInterface {
    fn mint(env: Env, to: Address, amount: i128);
}

#[contracttype]
enum DataKey {
    Admin,
    /// Coin contract used for payment.
    Coin,
    /// Pack contract minted to buyers.
    Pack,
    /// Where paid Coin is sent.
    Treasury,
    /// Price of one pack, in Coin.
    Price,
}

#[contract]
pub struct Store;

#[contractimpl]
impl Store {
    pub fn __constructor(
        e: &Env,
        admin: Address,
        coin: Address,
        pack: Address,
        treasury: Address,
        price: i128,
    ) {
        if price <= 0 {
            panic!("store: price must be positive");
        }
        let s = e.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Coin, &coin);
        s.set(&DataKey::Pack, &pack);
        s.set(&DataKey::Treasury, &treasury);
        s.set(&DataKey::Price, &price);
    }

    /// Buy one sealed pack: pay `price` Coin to the treasury, receive one pack.
    /// Authorized by `buyer` (whose auth also covers the Coin transfer).
    pub fn buy_pack(e: &Env, buyer: Address) {
        buyer.require_auth();

        let to: MuxedAddress = Self::treasury(e).into();
        CoinPay::new(e, &Self::coin(e)).transfer(&buyer, &to, &Self::price(e));
        PackMint::new(e, &Self::pack(e)).mint(&buyer, &1);
        common::extend_instance(e);
    }

    pub fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn coin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Coin).unwrap()
    }

    pub fn pack(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Pack).unwrap()
    }

    pub fn treasury(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Treasury).unwrap()
    }

    pub fn price(e: &Env) -> i128 {
        e.storage().instance().get(&DataKey::Price).unwrap()
    }
}

#[cfg(test)]
mod test;
