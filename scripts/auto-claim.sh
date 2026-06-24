#!/usr/bin/env bash
#
# auto-claim.sh — claim Coin, buy a pack, and open it on Stellar testnet.
# Supports multiple wallets.
#
# Prerequisites:
#   1. Install stellar CLI: https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli
#   2. Create or import your keys:
#        stellar keys generate wallet1 --network testnet --fund
#        stellar keys generate wallet2 --network testnet --fund
#        stellar keys add wallet3 --secret-key
#   3. Copy .env.example to .env and fill in contract IDs + wallet names
#
# Usage:
#   ./auto-claim.sh              # claim + buy + open for all wallets
#   ./auto-claim.sh --dry-run    # show what would happen
#
# Cron (every 3h):
#   0 */3 * * * /path/to/scripts/auto-claim.sh >> /var/log/auto-claim.log 2>&1
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

# ── load config ──────────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

FAUCET_ID="${FAUCET_CONTRACT_ID:?Set FAUCET_CONTRACT_ID in $ENV_FILE}"
STORE_ID="${STORE_CONTRACT_ID:?Set STORE_CONTRACT_ID in $ENV_FILE}"
PACK_ID="${PACK_CONTRACT_ID:?Set PACK_CONTRACT_ID in $ENV_FILE}"
NETWORK="${STELLAR_NETWORK:-testnet}"
DRY_RUN="${1:-}"

IFS=',' read -ra WALLETS <<< "${STELLAR_WALLETS:?Set STELLAR_WALLETS in $ENV_FILE (comma-separated key names)}"

# ── helpers ──────────────────────────────────────────────────────────────────
ts() { date -u '+%Y-%m-%d %H:%M:%S UTC'; }
die() { echo "[$(ts)] ERROR: $*" >&2; }

invoke() {
  local contract_id="$1"; shift
  local key="$1"; shift
  stellar contract invoke \
    --id "$contract_id" \
    --network "$NETWORK" \
    --source "$key" \
    -- "$@"
}

# ── preflight ────────────────────────────────────────────────────────────────
command -v stellar >/dev/null 2>&1 || { die "stellar CLI not found"; exit 1; }

echo "[$(ts)] ══ auto-claim start (${#WALLETS[@]} wallets) ══"

ERRORS=0

for KEY_NAME in "${WALLETS[@]}"; do
  KEY_NAME=$(echo "$KEY_NAME" | xargs) # trim whitespace

  ADDRESS=$(stellar keys address "$KEY_NAME" 2>/dev/null) || {
    die "[$KEY_NAME] Key not found. Run: stellar keys generate $KEY_NAME --network $NETWORK --fund"
    ERRORS=$((ERRORS + 1))
    continue
  }

  echo ""
  echo "[$(ts)] ── $KEY_NAME ($ADDRESS) ──"

  # ── check cooldown ────────────────────────────────────────────────────────
  LAST=$(invoke "$FAUCET_ID" "$KEY_NAME" last_claim --claimer "$ADDRESS" 2>/dev/null || echo "0")
  COOLDOWN=$(invoke "$FAUCET_ID" "$KEY_NAME" cooldown 2>/dev/null || echo "0")
  NOW=$(date +%s)

  if [ "$LAST" != "0" ] && [ "$COOLDOWN" != "0" ]; then
    NEXT=$(( LAST + COOLDOWN ))
    if [ "$NOW" -lt "$NEXT" ]; then
      WAIT=$(( NEXT - NOW ))
      echo "[$(ts)] Cooldown active — ${WAIT}s remaining. Skipping."
      continue
    fi
  fi

  if [[ "$DRY_RUN" == "--dry-run" ]]; then
    echo "[$(ts)] DRY RUN — would claim, buy, open. Skipping."
    continue
  fi

  # ── claim ─────────────────────────────────────────────────────────────────
  echo "[$(ts)] Claiming coins..."
  CLAIMED=$(invoke "$FAUCET_ID" "$KEY_NAME" claim --claimer "$ADDRESS" 2>&1) || {
    die "[$KEY_NAME] Claim failed: $CLAIMED"
    ERRORS=$((ERRORS + 1))
    continue
  }
  echo "[$(ts)] Claimed $CLAIMED Coin"

  # ── buy pack ──────────────────────────────────────────────────────────────
  echo "[$(ts)] Buying pack..."
  invoke "$STORE_ID" "$KEY_NAME" buy_pack --buyer "$ADDRESS" >/dev/null 2>&1 || {
    die "[$KEY_NAME] Buy pack failed"
    ERRORS=$((ERRORS + 1))
    continue
  }
  echo "[$(ts)] Pack purchased"

  # ── open pack ─────────────────────────────────────────────────────────────
  echo "[$(ts)] Opening pack..."
  STICKERS=$(invoke "$PACK_ID" "$KEY_NAME" open --opener "$ADDRESS" 2>&1) || {
    die "[$KEY_NAME] Open pack failed: $STICKERS"
    ERRORS=$((ERRORS + 1))
    continue
  }
  echo "[$(ts)] Stickers drawn: $STICKERS"

done

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "[$(ts)] ══ done with $ERRORS error(s) ══"
  exit 1
else
  echo "[$(ts)] ══ done ══"
fi
