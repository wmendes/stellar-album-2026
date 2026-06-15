use crate::{Pack, PackClient};
use soroban_sdk::{testutils::Address as _, Address, Env};
use sticker::{Sticker, StickerClient};

/// Deploy Sticker + Pack and wire Pack as Sticker's minter (the Pack→Sticker edge).
/// Pack's own minter is `admin`, so packs can be minted directly for the demo.
fn setup<'a>(e: &'a Env) -> (StickerClient<'a>, PackClient<'a>, Address) {
    let admin = Address::generate(e);
    let sticker_id = e.register(Sticker, (admin.clone(), admin.clone(), admin.clone()));
    let pack_id = e.register(Pack, (admin.clone(), admin.clone(), sticker_id.clone()));

    let sticker = StickerClient::new(e, &sticker_id);
    sticker.set_minter(&pack_id);

    (sticker, PackClient::new(e, &pack_id), admin)
}

fn total_stickers(sticker: &StickerClient, owner: &Address) -> i128 {
    (0..common::TYPE_COUNT)
        .map(|t| sticker.balance(owner, &t))
        .sum()
}

#[test]
fn mint_increases_pack_balance() {
    let e = test_utils::setup();
    let (_sticker, pack, _admin) = setup(&e);
    let alice = Address::generate(&e);

    pack.mint(&alice, &2);

    assert_eq!(pack.balance(&alice), 2);
}

#[test]
fn open_burns_one_pack_and_mints_three_stickers() {
    let e = test_utils::setup();
    let (sticker, pack, _admin) = setup(&e);
    let alice = Address::generate(&e);
    pack.mint(&alice, &1);

    let drawn = pack.open(&alice);

    // The pack is consumed.
    assert_eq!(pack.balance(&alice), 0);
    // Exactly three stickers were minted, whatever the types.
    assert_eq!(drawn.len(), 3);
    assert_eq!(total_stickers(&sticker, &alice), 3);
    // Every drawn type is a real sticker.
    for t in drawn.iter() {
        assert!(common::is_valid_type(t));
    }
}

#[test]
fn opening_two_packs_mints_six_stickers() {
    let e = test_utils::setup();
    let (sticker, pack, _admin) = setup(&e);
    let alice = Address::generate(&e);
    pack.mint(&alice, &2);

    pack.open(&alice);
    pack.open(&alice);

    assert_eq!(pack.balance(&alice), 0);
    assert_eq!(total_stickers(&sticker, &alice), 6);
}

#[test]
#[should_panic(expected = "none to open")]
fn open_without_a_pack_traps() {
    let e = test_utils::setup();
    let (_sticker, pack, _admin) = setup(&e);
    let alice = Address::generate(&e);

    pack.open(&alice);
}
