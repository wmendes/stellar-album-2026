#!/usr/bin/env bash
# Generate typed TS clients for each contract from deployment artifacts.
# Run AFTER `make bootstrap` (repo root) has deployed and synced frontend/.env.local.
set -euo pipefail
cd "$(dirname "$0")/.."
caatinga generate --network testnet
