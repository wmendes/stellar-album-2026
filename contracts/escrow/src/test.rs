use crate::{Escrow, EscrowClient};
use soroban_sdk::{testutils::Address as _, Address, Env};
use sticker::{Sticker, StickerClient};

const CEO: u32 = 0;
const CTO: u32 = 1;

fn setup<'a>(e: &'a Env) -> (StickerClient<'a>, EscrowClient<'a>) {
    let admin = Address::generate(e);
    let sticker_id = e.register(Sticker, (admin.clone(), admin.clone(), admin.clone()));
    let escrow_id = e.register(Escrow, (admin.clone(), sticker_id.clone()));
    (
        StickerClient::new(e, &sticker_id),
        EscrowClient::new(e, &escrow_id),
    )
}

#[test]
fn create_then_accept_swaps_atomically() {
    let e = test_utils::setup();
    let (sticker, escrow) = setup(&e);
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);
    sticker.mint(&alice, &CEO, &1);
    sticker.mint(&bob, &CTO, &1);

    let id = escrow.create_offer(&alice, &CEO, &CTO);
    // The offered sticker is now in the escrow's custody.
    assert_eq!(sticker.balance(&alice, &CEO), 0);
    assert_eq!(sticker.balance(&escrow.address, &CEO), 1);

    escrow.accept_offer(&bob, &id);

    assert_eq!(sticker.balance(&alice, &CTO), 1);
    assert_eq!(sticker.balance(&bob, &CEO), 1);
    assert_eq!(sticker.balance(&escrow.address, &CEO), 0);
    assert!(!escrow.has_offer(&id));
}

#[test]
fn cancel_returns_custody() {
    let e = test_utils::setup();
    let (sticker, escrow) = setup(&e);
    let alice = Address::generate(&e);
    sticker.mint(&alice, &CEO, &1);

    let id = escrow.create_offer(&alice, &CEO, &CTO);
    assert_eq!(sticker.balance(&alice, &CEO), 0);

    escrow.cancel_offer(&id);

    assert_eq!(sticker.balance(&alice, &CEO), 1);
    assert!(!escrow.has_offer(&id));
}

#[test]
#[should_panic]
fn accept_without_wanted_sticker_traps() {
    let e = test_utils::setup();
    let (sticker, escrow) = setup(&e);
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);
    sticker.mint(&alice, &CEO, &1); // bob has no CTO

    let id = escrow.create_offer(&alice, &CEO, &CTO);
    escrow.accept_offer(&bob, &id);
}

#[test]
#[should_panic(expected = "no such offer")]
fn double_accept_traps() {
    let e = test_utils::setup();
    let (sticker, escrow) = setup(&e);
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);
    sticker.mint(&alice, &CEO, &1);
    sticker.mint(&bob, &CTO, &2);

    let id = escrow.create_offer(&alice, &CEO, &CTO);
    escrow.accept_offer(&bob, &id);
    escrow.accept_offer(&bob, &id); // offer already consumed
}

/// Atomicity: a failed accept leaves custody intact and the offer open —
/// nothing is half-moved.
#[test]
fn failed_accept_conserves_balances() {
    let e = test_utils::setup();
    let (sticker, escrow) = setup(&e);
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);
    sticker.mint(&alice, &CEO, &1); // bob cannot provide CTO

    let id = escrow.create_offer(&alice, &CEO, &CTO);
    let res = escrow.try_accept_offer(&bob, &id);

    assert!(res.is_err());
    assert_eq!(sticker.balance(&escrow.address, &CEO), 1);
    assert!(escrow.has_offer(&id));
}
