use crate::{Faucet, FaucetClient};
use coin::{Coin, CoinClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

const COOLDOWN: u64 = 60;
const SEED: i128 = 1_000;
const DRIP: i128 = 100;

/// Deploy Coin + Faucet and wire the Faucet as Coin's minter.
fn setup<'a>(e: &'a Env) -> (CoinClient<'a>, FaucetClient<'a>) {
    let admin = Address::generate(e);
    let coin_id = e.register(Coin, (admin.clone(), admin.clone()));
    let faucet_id = e.register(Faucet, (admin.clone(), coin_id.clone(), COOLDOWN, SEED, DRIP));

    let coin = CoinClient::new(e, &coin_id);
    coin.set_minter(&faucet_id); // the Faucet → Coin authority edge

    (coin, FaucetClient::new(e, &faucet_id))
}

#[test]
fn first_claim_grants_seed() {
    let e = test_utils::setup();
    let (coin, faucet) = setup(&e);
    let user = Address::generate(&e);

    let granted = faucet.claim(&user);

    assert_eq!(granted, SEED);
    assert_eq!(coin.balance(&user), SEED);
}

#[test]
#[should_panic(expected = "cooldown")]
fn second_claim_before_cooldown_traps() {
    let e = test_utils::setup();
    let (_coin, faucet) = setup(&e);
    let user = Address::generate(&e);

    faucet.claim(&user); // seed at t=0
    faucet.claim(&user); // immediate retry → cooldown not elapsed
}

#[test]
fn claim_after_cooldown_grants_drip() {
    let e = test_utils::setup();
    let (coin, faucet) = setup(&e);
    let user = Address::generate(&e);

    faucet.claim(&user); // seed at t=0
    e.ledger().set_timestamp(COOLDOWN + 1);
    let granted = faucet.claim(&user);

    assert_eq!(granted, DRIP);
    assert_eq!(coin.balance(&user), SEED + DRIP);
}
