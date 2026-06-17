#![no_std]
//! Escrow — the trustless sticker↔sticker trade (Class 4).
//!
//! This is the answer to "why a smart contract at all?". A maker posts an
//! offer: the contract takes their sticker into **custody** and holds it until
//! a taker accepts (atomic swap) or the maker cancels (custody returned). No
//! intermediary is trusted — the code is the escrow agent. See
//! docs/curriculum/class-4-store-escrow.md.

use soroban_sdk::{contract, contractclient, contractimpl, contracttype, Address, Env, Vec};

/// Sticker transfer interface (declared locally to avoid the cdylib dependency).
#[contractclient(name = "StickerSwap")]
pub trait StickerInterface {
    fn transfer(env: Env, from: Address, to: Address, sticker_type: u32, amount: i128);
}

/// A posted offer as held in storage. Public so generated clients can read it.
#[contracttype]
pub struct Offer {
    pub maker: Address,
    pub give_type: u32,
    pub want_type: u32,
}

/// An open offer plus its id — the shape returned to the frontend marketplace so
/// it can render "maker gives X, wants Y" and accept by id without typing.
#[contracttype]
pub struct OfferView {
    pub id: u64,
    pub maker: Address,
    pub give_type: u32,
    pub want_type: u32,
}

#[contracttype]
enum DataKey {
    /// Sticker contract traded through this escrow.
    Sticker,
    /// Next offer id.
    Counter,
    /// An open offer.
    Offer(u64),
}

#[contract]
pub struct Escrow;

#[contractimpl]
impl Escrow {
    pub fn __constructor(e: &Env, sticker: Address) {
        e.storage().instance().set(&DataKey::Sticker, &sticker);
    }

    /// Post an offer: deposit one `give_type` sticker into custody and advertise
    /// it for one `want_type`. Returns the offer id. Authorized by `maker`.
    pub fn create_offer(e: &Env, maker: Address, give_type: u32, want_type: u32) -> u64 {
        maker.require_auth();
        if !common::is_valid_type(give_type) || !common::is_valid_type(want_type) {
            panic!("escrow: unknown type");
        }

        // Take the offered sticker into custody (escrow holds it).
        StickerSwap::new(e, &Self::sticker(e)).transfer(
            &maker,
            &e.current_contract_address(),
            &give_type,
            &1,
        );

        let id = Self::next_id(e);
        let key = DataKey::Offer(id);
        e.storage().persistent().set(
            &key,
            &Offer {
                maker,
                give_type,
                want_type,
            },
        );
        common::extend_persistent(e, &key);
        id
    }

    /// Accept an open offer: the custodied sticker goes to the taker and the
    /// wanted sticker is pulled from the taker to the maker — atomically. If
    /// the taker can't provide the wanted sticker, the whole call reverts and
    /// custody is untouched. Authorized by `taker`.
    pub fn accept_offer(e: &Env, taker: Address, offer_id: u64) {
        taker.require_auth();

        let key = DataKey::Offer(offer_id);
        let offer: Offer = match e.storage().persistent().get(&key) {
            Some(o) => o,
            None => panic!("escrow: no such offer"),
        };
        // Defense in depth: accepting your own offer is meaningless, and the
        // taker -> maker leg below would self-transfer the wanted sticker. The
        // root fix lives in `sticker::transfer`, but reject self-dealing here
        // outright so the escrow never relies on that for soundness.
        if taker == offer.maker {
            panic!("escrow: cannot accept your own offer");
        }
        // Checks-effects-interactions: consume the offer before moving assets.
        e.storage().persistent().remove(&key);

        let sticker = StickerSwap::new(e, &Self::sticker(e));
        let escrow = e.current_contract_address();
        sticker.transfer(&escrow, &taker, &offer.give_type, &1);
        sticker.transfer(&taker, &offer.maker, &offer.want_type, &1);
    }

    /// Cancel an open offer and return the custodied sticker. Maker only.
    pub fn cancel_offer(e: &Env, offer_id: u64) {
        let key = DataKey::Offer(offer_id);
        let offer: Offer = match e.storage().persistent().get(&key) {
            Some(o) => o,
            None => panic!("escrow: no such offer"),
        };
        offer.maker.require_auth();
        e.storage().persistent().remove(&key);

        StickerSwap::new(e, &Self::sticker(e)).transfer(
            &e.current_contract_address(),
            &offer.maker,
            &offer.give_type,
            &1,
        );
    }

    pub fn has_offer(e: &Env, offer_id: u64) -> bool {
        e.storage().persistent().has(&DataKey::Offer(offer_id))
    }

    /// Read one offer's contents, or `None` if it was accepted/cancelled.
    pub fn get_offer(e: &Env, offer_id: u64) -> Option<Offer> {
        e.storage().persistent().get(&DataKey::Offer(offer_id))
    }

    /// Every currently-open offer, with its id. Lets the frontend show a visual
    /// marketplace instead of asking the user to type an offer number. Scans
    /// `0..Counter`; accepted/cancelled ids are simply absent.
    pub fn offers(e: &Env) -> Vec<OfferView> {
        let count: u64 = e.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        let mut out = Vec::new(e);
        for id in 0..count {
            if let Some(o) = e
                .storage()
                .persistent()
                .get::<_, Offer>(&DataKey::Offer(id))
            {
                out.push_back(OfferView {
                    id,
                    maker: o.maker,
                    give_type: o.give_type,
                    want_type: o.want_type,
                });
            }
        }
        out
    }

    pub fn sticker(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Sticker).unwrap()
    }

    fn next_id(e: &Env) -> u64 {
        let id: u64 = e.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        e.storage().instance().set(&DataKey::Counter, &(id + 1));
        common::extend_instance(e);
        id
    }
}

#[cfg(test)]
mod test;
