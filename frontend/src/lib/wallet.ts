import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  allowAllModules,
} from "@creit.tech/stellar-wallets-kit";
import { NETWORK_PASSPHRASE } from "./network";

// Register every no-config browser/web wallet the kit ships (Freighter, xBull,
// Albedo, Rabet, Lobstr, Hana, HOT, Klever) so the picker isn't Freighter-only.
// Freighter stays the default highlight; the modal lets the user pick any.
// (Ledger / Trezor / WalletConnect are intentionally excluded — they need extra
// peer deps and a WalletConnect projectId.)
export const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules: allowAllModules(),
});

// Which wallet the user last connected with. Persisting just the wallet id (not
// keys — those never leave the wallet) lets us silently re-establish the session
// after a page reload instead of forcing a reconnect.
const WALLET_KEY = "stellar-album:wallet-id";

/** Open the wallet picker and return the selected account address. */
export async function connect(): Promise<string> {
  return new Promise((resolve, reject) => {
    kit.openModal({
      onWalletSelected: async (option) => {
        try {
          kit.setWallet(option.id);
          const { address } = await kit.getAddress();
          localStorage.setItem(WALLET_KEY, option.id);
          resolve(address);
        } catch (e) {
          reject(e);
        }
      },
      onClosed: () => reject(new Error("wallet selection cancelled")),
    });
  });
}

// Deduplicate concurrent restore() calls so React StrictMode's double-effect
// invocation doesn't trigger two wallet popups.
let restoreInFlight: Promise<string | null> | null = null;

/**
 * Silently restore a previously-connected wallet on page load. Returns the
 * address, or `null` if there's no saved session or it can't be restored (e.g.
 * the wallet is locked or no longer authorizes this site) — in which case the
 * caller just shows the connect screen.
 */
export async function restore(): Promise<string | null> {
  if (restoreInFlight) return restoreInFlight;

  restoreInFlight = (async () => {
    const id = localStorage.getItem(WALLET_KEY);
    if (!id) return null;
    try {
      kit.setWallet(id);
      const { address } = await kit.getAddress();
      return address || null;
    } catch {
      return null;
    } finally {
      restoreInFlight = null;
    }
  })();

  return restoreInFlight;
}

/** Forget the saved session (sign out). */
export function disconnect(): void {
  localStorage.removeItem(WALLET_KEY);
}

/** Sign callback handed to the generated contract clients. */
export async function signTransaction(xdr: string) {
  const { signedTxXdr } = await kit.signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  return { signedTxXdr };
}
