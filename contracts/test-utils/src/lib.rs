//! Dev-only test helpers shared across the workspace.
//!
//! Used from contract `[dev-dependencies]` and the integration `tests` crate.
//! Never linked into a deployed contract.

use soroban_sdk::Env;

/// A fresh test environment with all authorizations mocked.
///
/// This is the standard starting point for unit and integration tests:
/// `let env = setup();`. For tests that must *prove* an auth gate rejects an
/// unauthorized caller, do NOT use this — construct `Env::default()` and use
/// selective `mock_auths` instead.
pub fn setup() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}
