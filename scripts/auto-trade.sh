#!/usr/bin/env bash
#
# auto-trade.sh — accept escrow offers for stickers I need, if I have what they want.
#
# Only accepts offers where:
#   - The offer GIVES a type I need (configured in WANT_TYPES)
#   - I HAVE the type the offer WANTS (balance > 0)
#   - I haven't already pasted that type in my album
#
# Usage:
#   ./auto-trade.sh              # scan and trade for all wallets
#   ./auto-trade.sh --dry-run    # show what would happen
#
# Cron (daily):
#   0 13 * * * /path/to/scripts/auto-trade.sh >> /var/log/auto-trade.log 2>&1
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

# ── load config ──────────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

ESCROW_ID="${ESCROW_CONTRACT_ID:?Set ESCROW_CONTRACT_ID in $ENV_FILE}"
STICKER_ID="${STICKER_CONTRACT_ID:?Set STICKER_CONTRACT_ID in $ENV_FILE}"
ALBUM_ID="${ALBUM_CONTRACT_ID:?Set ALBUM_CONTRACT_ID in $ENV_FILE}"
NETWORK="${STELLAR_NETWORK:-testnet}"
DRY_RUN="${1:-}"

IFS=',' read -ra WALLETS <<< "${STELLAR_WALLETS:?Set STELLAR_WALLETS in $ENV_FILE}"
IFS=',' read -ra WANT_TYPES <<< "${WANT_STICKER_TYPES:-7,10,18,19}"

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

is_wanted() {
  local t="$1"
  for w in "${WANT_TYPES[@]}"; do
    [ "$(echo "$w" | xargs)" = "$t" ] && return 0
  done
  return 1
}

# ── preflight ────────────────────────────────────────────────────────────────
command -v stellar >/dev/null 2>&1 || { die "stellar CLI not found"; exit 1; }
command -v jq >/dev/null 2>&1 || { die "jq not found — install with: apt install jq"; exit 1; }

echo "[$(ts)] ══ auto-trade start ══"
echo "[$(ts)] Want types: ${WANT_TYPES[*]}"

# ── fetch all open offers (once, reuse for all wallets) ─────────────────────
echo "[$(ts)] Fetching open offers..."
OFFERS_RAW=$(invoke "$ESCROW_ID" "${WALLETS[0]}" offers 2>/dev/null || echo "[]")

OFFER_COUNT=$(echo "$OFFERS_RAW" | jq 'length' 2>/dev/null || echo "0")
echo "[$(ts)] Found $OFFER_COUNT open offer(s)"

if [ "$OFFER_COUNT" = "0" ]; then
  echo "[$(ts)] No offers available. Done."
  exit 0
fi

ERRORS=0
TRADES=0

for KEY_NAME in "${WALLETS[@]}"; do
  KEY_NAME=$(echo "$KEY_NAME" | xargs)

  ADDRESS=$(stellar keys address "$KEY_NAME" 2>/dev/null) || {
    die "[$KEY_NAME] Key not found"
    ERRORS=$((ERRORS + 1))
    continue
  }

  echo ""
  echo "[$(ts)] ── $KEY_NAME ($ADDRESS) ──"

  for i in $(seq 0 $((OFFER_COUNT - 1))); do
    OFFER_ID=$(echo "$OFFERS_RAW" | jq -r ".[$i].id" 2>/dev/null)
    MAKER=$(echo "$OFFERS_RAW" | jq -r ".[$i].maker" 2>/dev/null)
    GIVE_TYPE=$(echo "$OFFERS_RAW" | jq -r ".[$i].give_type" 2>/dev/null)
    WANT_TYPE=$(echo "$OFFERS_RAW" | jq -r ".[$i].want_type" 2>/dev/null)

    [ -z "$OFFER_ID" ] || [ "$OFFER_ID" = "null" ] && continue

    # skip own offers
    [ "$MAKER" = "$ADDRESS" ] && continue

    # skip if give_type is not one I want
    is_wanted "$GIVE_TYPE" || continue

    # skip if already pasted in album
    PASTED=$(invoke "$ALBUM_ID" "$KEY_NAME" is_pasted --owner "$ADDRESS" --sticker_type "$GIVE_TYPE" 2>/dev/null || echo "false")
    [ "$PASTED" = "true" ] && continue

    # check if I have the sticker they want
    BAL=$(invoke "$STICKER_ID" "$KEY_NAME" balance --owner "$ADDRESS" --sticker_type "$WANT_TYPE" 2>/dev/null || echo "0")
    [ "$BAL" = "0" ] && continue

    echo "[$(ts)] Offer #$OFFER_ID: gives type $GIVE_TYPE, wants type $WANT_TYPE (I have $BAL)"

    if [[ "$DRY_RUN" == "--dry-run" ]]; then
      echo "[$(ts)] DRY RUN — would accept offer #$OFFER_ID"
      continue
    fi

    echo "[$(ts)] Accepting offer #$OFFER_ID..."
    invoke "$ESCROW_ID" "$KEY_NAME" accept_offer --taker "$ADDRESS" --offer_id "$OFFER_ID" >/dev/null 2>&1 || {
      die "[$KEY_NAME] Failed to accept offer #$OFFER_ID"
      ERRORS=$((ERRORS + 1))
      continue
    }
    echo "[$(ts)] Trade complete! Got type $GIVE_TYPE for type $WANT_TYPE"
    TRADES=$((TRADES + 1))
  done

done

echo ""
echo "[$(ts)] ══ done — $TRADES trade(s)"
[ "$ERRORS" -gt 0 ] && echo "[$(ts)] $ERRORS error(s)" && exit 1
exit 0
