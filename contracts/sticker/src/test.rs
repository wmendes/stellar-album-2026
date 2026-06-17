use crate::{Sticker, StickerClient};
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal,
};

const CEO: u32 = 0; // a common type
const LEGENDARY: u32 = 18; // a legendary type

/// Deploy with distinct admin / minter / burner test addresses.
fn deploy<'a>(
    e: &'a Env,
    admin: &Address,
    minter: &Address,
    burner: &Address,
) -> StickerClient<'a> {
    let id = e.register(Sticker, (admin.clone(), minter.clone(), burner.clone()));
    StickerClient::new(e, &id)
}

#[test]
fn mint_increases_balance_and_supply() {
    let e = test_utils::setup();
    let admin = Address::generate(&e);
    let minter = Address::generate(&e);
    let alice = Address::generate(&e);
    let sticker = deploy(&e, &admin, &minter, &admin);

    sticker.mint(&alice, &CEO, &3);

    assert_eq!(sticker.balance(&alice, &CEO), 3);
    assert_eq!(sticker.supply(&CEO), 3);
}

#[test]
fn unminted_type_balance_is_zero() {
    let e = test_utils::setup();
    let admin = Address::generate(&e);
    let bob = Address::generate(&e);
    let sticker = deploy(&e, &admin, &admin, &admin);

    assert_eq!(sticker.balance(&bob, &LEGENDARY), 0);
}

#[test]
fn transfer_moves_one_copy_of_a_type() {
    let e = test_utils::setup();
    let admin = Address::generate(&e);
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);
    let sticker = deploy(&e, &admin, &admin, &admin);

    sticker.mint(&alice, &CEO, &2);
    sticker.transfer(&alice, &bob, &CEO, &1);

    assert_eq!(sticker.balance(&alice, &CEO), 1);
    assert_eq!(sticker.balance(&bob, &CEO), 1);
    // Supply is unchanged by a transfer.
    assert_eq!(sticker.supply(&CEO), 2);
}

#[test]
fn burn_reduces_balance_and_supply() {
    let e = test_utils::setup();
    let admin = Address::generate(&e);
    let burner = Address::generate(&e);
    let alice = Address::generate(&e);
    let sticker = deploy(&e, &admin, &admin, &burner);

    sticker.mint(&alice, &CEO, &2);
    sticker.burn(&alice, &CEO, &1);

    assert_eq!(sticker.balance(&alice, &CEO), 1);
    assert_eq!(sticker.supply(&CEO), 1);
}

/// Regression: a self-transfer (`from == to`) must be a no-op and must NOT
/// inflate the balance. Before the guard, `to_bal` was read before the `from`
/// debit was written, so the credit write overwrote the debit and the holder
/// gained `amount` out of thin air (balance 1 → 2 while supply stayed 1).
#[test]
fn self_transfer_does_not_inflate() {
    let e = test_utils::setup();
    let admin = Address::generate(&e);
    let alice = Address::generate(&e);
    let sticker = deploy(&e, &admin, &admin, &admin);

    sticker.mint(&alice, &CEO, &1);
    sticker.transfer(&alice, &alice, &CEO, &1); // from == to

    assert_eq!(sticker.balance(&alice, &CEO), 1);
    assert_eq!(sticker.supply(&CEO), 1);
}

/// A self-transfer above the held balance must still trap, like any transfer.
#[test]
#[should_panic(expected = "insufficient balance")]
fn self_transfer_above_balance_traps() {
    let e = test_utils::setup();
    let admin = Address::generate(&e);
    let alice = Address::generate(&e);
    let sticker = deploy(&e, &admin, &admin, &admin);

    sticker.mint(&alice, &CEO, &1);
    sticker.transfer(&alice, &alice, &CEO, &2);
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn transfer_more_than_held_traps() {
    let e = test_utils::setup();
    let admin = Address::generate(&e);
    let alice = Address::generate(&e);
    let bob = Address::generate(&e);
    let sticker = deploy(&e, &admin, &admin, &admin);

    sticker.mint(&alice, &CEO, &1);
    sticker.transfer(&alice, &bob, &CEO, &2);
}

#[test]
#[should_panic(expected = "unknown type")]
fn mint_unknown_type_traps() {
    let e = test_utils::setup();
    let admin = Address::generate(&e);
    let alice = Address::generate(&e);
    let sticker = deploy(&e, &admin, &admin, &admin);

    sticker.mint(&alice, &common::TYPE_COUNT, &1); // out of range
}

#[test]
#[should_panic(expected = "must be positive")]
fn mint_zero_amount_traps() {
    let e = test_utils::setup();
    let admin = Address::generate(&e);
    let alice = Address::generate(&e);
    let sticker = deploy(&e, &admin, &admin, &admin);

    sticker.mint(&alice, &CEO, &0);
}

/// `mint` is gated to the configured minter — proven by authorizing exactly
/// that address for exactly that call.
#[test]
fn mint_requires_minter_auth() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let minter = Address::generate(&e);
    let alice = Address::generate(&e);
    let sticker = deploy(&e, &admin, &minter, &admin);

    e.mock_auths(&[MockAuth {
        address: &minter,
        invoke: &MockAuthInvoke {
            contract: &sticker.address,
            fn_name: "mint",
            args: (alice.clone(), CEO, 1_i128).into_val(&e),
            sub_invokes: &[],
        },
    }]);
    sticker.mint(&alice, &CEO, &1);

    assert_eq!(sticker.balance(&alice, &CEO), 1);
}

#[test]
#[should_panic]
fn mint_without_minter_auth_traps() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let minter = Address::generate(&e);
    let alice = Address::generate(&e);
    let sticker = deploy(&e, &admin, &minter, &admin);

    sticker.mint(&alice, &CEO, &1); // no auth mocked
}

#[test]
fn admin_can_repoint_minter_and_burner() {
    let e = test_utils::setup();
    let admin = Address::generate(&e);
    let new_minter = Address::generate(&e);
    let new_burner = Address::generate(&e);
    let sticker = deploy(&e, &admin, &admin, &admin);

    sticker.set_minter(&new_minter);
    sticker.set_burner(&new_burner);

    assert_eq!(sticker.minter(), new_minter);
    assert_eq!(sticker.burner(), new_burner);
}
