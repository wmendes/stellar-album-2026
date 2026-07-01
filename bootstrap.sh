#!/usr/bin/env bash
# Deprecated: use `make bootstrap` or `caatinga deploy --source deployer --network testnet`.
set -euo pipefail
echo "bootstrap.sh is deprecated. Run: make bootstrap" >&2
exec caatinga deploy --source deployer --network testnet "$@"
