//! Class 1 — "reproduce this": the fungible loop.
//!
//! Mirrors docs/curriculum/class-1-coin-faucet.md: deploy Coin + Faucet, wire
//! the minter, claim the onboarding seed, see the cooldown reject an early
//! re-claim, then claim the drip after the cooldown. The test IS the demo.

use coin::{Coin, CoinClient};
use faucet::{Faucet, FaucetClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address,
};
use test_utils::setup;

#[test]
fn reproduce_class_1() {
    let e = setup();
    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    // Deploy Coin (placeholder minter) and Faucet, then wire the Faucet as
    // Coin's minter — the first cross-contract authority edge.
    let coin_id = e.register(Coin, (admin.clone(), admin.clone()));
    let faucet_id = e.register(
        Faucet,
        (admin.clone(), coin_id.clone(), 60_u64, 1_000_i128, 100_i128),
    );
    let coin = CoinClient::new(&e, &coin_id);
    let faucet = FaucetClient::new(&e, &faucet_id);
    coin.set_minter(&faucet_id);

    // First claim → onboarding seed of 1000.
    assert_eq!(faucet.claim(&user), 1_000);
    assert_eq!(coin.balance(&user), 1_000);

    // Claiming again before the cooldown elapses fails.
    assert!(faucet.try_claim(&user).is_err());

    // After the cooldown, a claim grants the drip of 100.
    e.ledger().set_timestamp(61);
    assert_eq!(faucet.claim(&user), 100);
    assert_eq!(coin.balance(&user), 1_100);
}
