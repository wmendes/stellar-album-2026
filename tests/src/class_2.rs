//! Class 2 — "reproduce this": semi-fungibility.
//!
//! Mirrors docs/curriculum/class-2-sticker.md: mint duplicates of one type and
//! a single legendary, then move one copy — proving copies of a type are
//! fungible with each other while types are distinct. The test IS the demo.

use soroban_sdk::{testutils::Address as _, Address};
use sticker::{Sticker, StickerClient};
use test_utils::setup;

const CEO: u32 = 0; // a common type
const LEGENDARY: u32 = 18; // a legendary type

#[test]
fn reproduce_class_2() {
    let e = setup();
    let admin = Address::generate(&e);
    let shop = Address::generate(&e); // stands in for the Pack/minter
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);

    let id = e.register(Sticker, (admin.clone(), shop.clone(), admin.clone()));
    let sticker = StickerClient::new(&e, &id);

    // Mint Alice 3 copies of the CEO (a duplicate!) and 1 legendary.
    sticker.mint(&alice, &CEO, &3);
    sticker.mint(&alice, &LEGENDARY, &1);
    assert_eq!(sticker.balance(&alice, &CEO), 3);
    assert_eq!(sticker.balance(&alice, &LEGENDARY), 1);

    // Copies of a type are fungible with each other: send one CEO to Bob.
    sticker.transfer(&alice, &bob, &CEO, &1);
    assert_eq!(sticker.balance(&alice, &CEO), 2);
    assert_eq!(sticker.balance(&bob, &CEO), 1);

    // But types are distinct — Bob holds a CEO, not a legendary.
    assert_eq!(sticker.balance(&bob, &LEGENDARY), 0);
    assert_eq!(sticker.supply(&CEO), 3);
}
