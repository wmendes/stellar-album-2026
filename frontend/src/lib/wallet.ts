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

/** Open the wallet picker and return the selected account address. */
export async function connect(): Promise<string> {
  return new Promise((resolve, reject) => {
    kit.openModal({
      onWalletSelected: async (option) => {
        try {
          kit.setWallet(option.id);
          const { address } = await kit.getAddress();
          resolve(address);
        } catch (e) {
          reject(e);
        }
      },
      onClosed: () => reject(new Error("wallet selection cancelled")),
    });
  });
}

/** Sign callback handed to the generated contract clients. */
export async function signTransaction(xdr: string) {
  const { signedTxXdr } = await kit.signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  return { signedTxXdr };
}
