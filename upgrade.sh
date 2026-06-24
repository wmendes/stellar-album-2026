#!/usr/bin/env bash
#
# upgrade.sh — upgrade ONE deployed contract in place, preserving its contract
# id and all persistent state. This is the state-preserving alternative to a
# full re-bootstrap: balances, albums, and open offers survive. See SPEC.md
# (PR-UPG / DEP-1) and docs/decisions.md D24.
#
# Usage: ./upgrade.sh <coin|sticker|faucet|pack|album|store|escrow>
# Requires: stellar CLI 26+, an existing frontend/.env.local (run bootstrap
# first), and the `deployer` key that is the admin of the contracts.
set -euo pipefail

NETWORK="testnet"
WASM_DIR="target/wasm32v1-none/release"
ENV_OUT="frontend/.env.local"
NAME="${1:?usage: ./upgrade.sh <coin|sticker|faucet|pack|album|store|escrow>}"

say() { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }

# Resolve the contract id from the emitted frontend config (VITE_<NAME>).
VAR="VITE_$(printf '%s' "$NAME" | tr '[:lower:]' '[:upper:]')"
ID=$(grep "^$VAR=" "$ENV_OUT" | cut -d= -f2 || true)
[ -n "${ID:-}" ] || { echo "no $VAR in $ENV_OUT — deploy with ./bootstrap.sh first"; exit 1; }

say "Building wasms"
stellar contract build

say "Installing new $NAME wasm on $NETWORK"
HASH=$(stellar contract upload \
  --wasm "$WASM_DIR/$NAME.wasm" \
  --source deployer --network "$NETWORK" | tail -n1)
echo "wasm hash: $HASH"

say "Upgrading $NAME ($ID) in place — admin-signed, state preserved"
stellar contract invoke \
  --id "$ID" --source deployer --network "$NETWORK" \
  -- upgrade --new_wasm_hash "$HASH" >/dev/null

say "Done: $NAME upgraded. Contract id unchanged ($ID); $ENV_OUT untouched."
