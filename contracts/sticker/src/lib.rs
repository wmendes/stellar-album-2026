#![no_std]
//! Sticker — the semi-fungible collectibles (Class 2, the star class).
//!
//! A hand-rolled multi-token (ERC-1155-style): there is no multi-token in the
//! OpenZeppelin Stellar library, and building it from scratch is the point —
//! the balance lives at `(owner, type_id)`, so copies of one type are fungible
//! with each other (a *duplicate*) while different types are not. See
//! docs/decisions.md D8 and docs/curriculum/class-2-sticker.md.
//!
//! Authority (the settable-address convention, D12):
//!   - `mint`   → the minter (the Pack contract, Phase 4)
//!   - `burn`   → the burner (the Album contract, Phase 6, when pasting)
//!   - `transfer` → the `from` owner (also how the Escrow moves stickers)

use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env};

#[contracttype]
enum DataKey {
    /// May repoint the minter/burner.
    Admin,
    /// The only address allowed to `mint`.
    Minter,
    /// The only address allowed to `burn`.
    Burner,
    /// Balance of `(owner, type_id)`.
    Balance(Address, u32),
    /// Total minted-minus-burned for a type.
    Supply(u32),
}

#[contract]
pub struct Sticker;

#[contractimpl]
impl Sticker {
    pub fn __constructor(e: &Env, admin: Address, minter: Address, burner: Address) {
        let s = e.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Minter, &minter);
        s.set(&DataKey::Burner, &burner);
    }

    // --- queries ---

    /// How many of `sticker_type` `owner` holds (0 if none).
    pub fn balance(e: &Env, owner: Address, sticker_type: u32) -> i128 {
        e.storage()
            .persistent()
            .get(&DataKey::Balance(owner, sticker_type))
            .unwrap_or(0)
    }

    /// Total in circulation for `sticker_type`.
    pub fn supply(e: &Env, sticker_type: u32) -> i128 {
        e.storage()
            .persistent()
            .get(&DataKey::Supply(sticker_type))
            .unwrap_or(0)
    }

    pub fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn minter(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Minter).unwrap()
    }

    pub fn burner(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Burner).unwrap()
    }

    // --- mutations ---

    /// Mint `amount` of `sticker_type` to `to`. Minter only.
    pub fn mint(e: &Env, to: Address, sticker_type: u32, amount: i128) {
        Self::minter(e).require_auth();
        require_valid(sticker_type, amount);

        let bal = Self::balance(e, to.clone(), sticker_type);
        set_balance(e, &to, sticker_type, bal + amount);
        set_supply(e, sticker_type, Self::supply(e, sticker_type) + amount);
        common::extend_instance(e);
    }

    /// Burn `amount` of `sticker_type` from `from`. Burner only (the Album, on paste).
    pub fn burn(e: &Env, from: Address, sticker_type: u32, amount: i128) {
        Self::burner(e).require_auth();
        require_valid(sticker_type, amount);

        let bal = Self::balance(e, from.clone(), sticker_type);
        if bal < amount {
            panic!("sticker: insufficient balance");
        }
        set_balance(e, &from, sticker_type, bal - amount);
        set_supply(e, sticker_type, Self::supply(e, sticker_type) - amount);
    }

    /// Move `amount` of `sticker_type` from `from` to `to`. Authorized by `from`.
    pub fn transfer(e: &Env, from: Address, to: Address, sticker_type: u32, amount: i128) {
        from.require_auth();
        require_valid(sticker_type, amount);

        let from_bal = Self::balance(e, from.clone(), sticker_type);
        if from_bal < amount {
            panic!("sticker: insufficient balance");
        }
        let to_bal = Self::balance(e, to.clone(), sticker_type);
        set_balance(e, &from, sticker_type, from_bal - amount);
        set_balance(e, &to, sticker_type, to_bal + amount);
    }

    // --- admin ---

    pub fn set_minter(e: &Env, new_minter: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Minter, &new_minter);
        common::extend_instance(e);
    }

    pub fn set_burner(e: &Env, new_burner: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Burner, &new_burner);
        common::extend_instance(e);
    }

    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        common::upgrade(e, &Self::admin(e), new_wasm_hash);
    }
}

/// Reject unknown types and non-positive amounts.
fn require_valid(sticker_type: u32, amount: i128) {
    if !common::is_valid_type(sticker_type) {
        panic!("sticker: unknown type");
    }
    if amount <= 0 {
        panic!("sticker: amount must be positive");
    }
}

fn set_balance(e: &Env, owner: &Address, sticker_type: u32, amount: i128) {
    let key = DataKey::Balance(owner.clone(), sticker_type);
    e.storage().persistent().set(&key, &amount);
    common::extend_persistent(e, &key);
}

fn set_supply(e: &Env, sticker_type: u32, amount: i128) {
    let key = DataKey::Supply(sticker_type);
    e.storage().persistent().set(&key, &amount);
    common::extend_persistent(e, &key);
}

#[cfg(test)]
mod test;
