.PHONY: all build test fmt fmt-check lint wasm clean

# Run the full local gate (mirrors CI).
all: fmt-check lint test wasm

build:
	cargo build

test:
	cargo test --workspace

fmt:
	cargo fmt --all

fmt-check:
	cargo fmt --all --check

lint:
	cargo clippy --workspace --all-targets -- -D warnings

# Build all contract wasms (cdylib crates only).
wasm:
	stellar contract build

# Deploy + wire all 7 contracts on testnet and emit frontend/.env.local.
bootstrap:
	caatinga deploy --source deployer --network testnet

clean:
	cargo clean
