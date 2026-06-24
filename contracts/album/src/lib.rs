#![no_std]
//! Album — the soulbound collection (Class 3, the non-fungible extreme).
//!
//! One album per person, carrying unique state (which of the 20 slots are
//! filled). It is **soulbound** in the strongest possible sense: there is no
//! transfer function at all — an album cannot leave its owner. "Pasting" a
//! sticker **burns** it (via the Sticker contract, of which the Album is the
//! burner) and marks the slot; this is irreversible. See
//! docs/curriculum/class-3-pack-album.md and docs/decisions.md D17.

use soroban_sdk::{contract, contractclient, contractimpl, contracttype, Address, BytesN, Env};

/// Minimal view of the Sticker contract the Album burns from. Declared locally
/// to avoid depending on the `sticker` cdylib (`__constructor` collision).
#[contractclient(name = "StickerBurn")]
pub trait StickerInterface {
    fn burn(env: Env, from: Address, sticker_type: u32, amount: i128);
}

#[contracttype]
enum DataKey {
    Admin,
    /// Address of the Sticker contract pasted stickers are burned from.
    Sticker,
    /// Whether `owner` has opened an album.
    Exists(Address),
    /// Whether `(owner, type)` slot is filled.
    Slot(Address, u32),
    /// Number of filled slots for `owner`.
    Filled(Address),
}

#[contract]
pub struct Album;

#[contractimpl]
impl Album {
    pub fn __constructor(e: &Env, admin: Address, sticker: Address) {
        let s = e.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Sticker, &sticker);
    }

    /// Open a fresh (empty) album for `owner`. One per person — traps if the
    /// caller already has one. This is the album's soulbound "mint".
    pub fn open_album(e: &Env, owner: Address) {
        owner.require_auth();
        if Self::has_album(e, owner.clone()) {
            panic!("album: already has an album");
        }
        let key = DataKey::Exists(owner.clone());
        e.storage().persistent().set(&key, &true);
        common::extend_persistent(e, &key);
    }

    /// Paste one sticker of `sticker_type` from `owner` into their album:
    /// burn the sticker and mark the slot filled. Irreversible. Authorized by
    /// `owner`.
    pub fn paste(e: &Env, owner: Address, sticker_type: u32) {
        owner.require_auth();
        if !Self::has_album(e, owner.clone()) {
            panic!("album: open an album first");
        }
        if !common::is_valid_type(sticker_type) {
            panic!("album: unknown type");
        }
        if Self::is_pasted(e, owner.clone(), sticker_type) {
            panic!("album: slot already filled");
        }

        StickerBurn::new(e, &Self::sticker(e)).burn(&owner, &sticker_type, &1);

        let slot = DataKey::Slot(owner.clone(), sticker_type);
        e.storage().persistent().set(&slot, &true);
        common::extend_persistent(e, &slot);

        let filled = DataKey::Filled(owner.clone());
        let next = Self::filled(e, owner.clone()) + 1;
        e.storage().persistent().set(&filled, &next);
        common::extend_persistent(e, &filled);
    }

    // --- queries ---

    pub fn has_album(e: &Env, owner: Address) -> bool {
        e.storage()
            .persistent()
            .get(&DataKey::Exists(owner))
            .unwrap_or(false)
    }

    pub fn is_pasted(e: &Env, owner: Address, sticker_type: u32) -> bool {
        e.storage()
            .persistent()
            .get(&DataKey::Slot(owner, sticker_type))
            .unwrap_or(false)
    }

    pub fn filled(e: &Env, owner: Address) -> u32 {
        e.storage()
            .persistent()
            .get(&DataKey::Filled(owner))
            .unwrap_or(0)
    }

    /// Whether the album is complete (all sticker types pasted).
    pub fn is_complete(e: &Env, owner: Address) -> bool {
        Self::filled(e, owner) == common::TYPE_COUNT
    }

    pub fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn sticker(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Sticker).unwrap()
    }

    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        common::upgrade(e, &Self::admin(e), new_wasm_hash);
    }
}

#[cfg(test)]
mod test;
