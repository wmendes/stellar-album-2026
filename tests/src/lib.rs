//! Cross-contract integration tests for stellar-album.
//!
//! Each `reproduce_class_N` test walks the exact narrative a developer replays
//! in that class — the test IS the demo (see docs/implementation-plan.md).
//! They are added phase by phase; Phase 0 ships only the scaffolding smoke test.

#[cfg(test)]
mod scaffold {
    use test_utils::setup;

    /// Phase 0 smoke test: the shared test environment boots.
    #[test]
    fn workspace_builds_and_env_boots() {
        let env = setup();
        // A trivial host call proves the env is live and linked correctly.
        let _ = env.ledger().timestamp();
    }
}

#[cfg(test)]
mod class_1;

#[cfg(test)]
mod class_2;
