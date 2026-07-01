// Contract IDs + network, injected by Vite from .env.local (written by
// `make bootstrap`).
export const CONTRACTS = {
  coin: import.meta.env.VITE_COIN as string,
  faucet: import.meta.env.VITE_FAUCET as string,
  store: import.meta.env.VITE_STORE as string,
  pack: import.meta.env.VITE_PACK as string,
  sticker: import.meta.env.VITE_STICKER as string,
  album: import.meta.env.VITE_ALBUM as string,
  escrow: import.meta.env.VITE_ESCROW as string,
};

export const RPC_URL = import.meta.env.VITE_RPC_URL as string;
export const NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE as string;

/** Fallback RPC endpoints tried in order when the primary fails. */
export const FALLBACK_RPC_URLS: string[] = [
  "https://soroban-testnet.stellar.org",
  "https://soroban-testnet.stellar.org:443",
];
