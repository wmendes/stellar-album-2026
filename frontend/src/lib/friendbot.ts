/**
 * Ensure the account exists on testnet. Calls friendbot directly — it returns
 * 400 when the account already exists, which we treat as success. We skip the
 * prior `getAccount` RPC check because soroban-testnet.stellar.org does not
 * send CORS headers, causing browser errors on every page load.
 * v1 only — replaced by a relay/sponsor on mainnet.
 */
export async function ensureFunded(address: string): Promise<void> {
  const res = await fetch(
    `https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`,
  );
  // 400 = "createAccountAlreadyExist" — fine.
  if (!res.ok && res.status !== 400) {
    throw new Error(`friendbot funding failed (${res.status})`);
  }
}
