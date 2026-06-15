// Typed contract clients, built from the generated bindings in src/contracts/*
// (run `npm run bindings` after `make bootstrap`).
// Import the generated source directly: the bindings emit a package whose
// `exports` points at ./dist/index.js, but there's no build step, so we point
// at src/index.ts (Vite bundles it; .ts import allowed by tsconfig).
import { Client as Coin } from "../contracts/coin/src/index.ts";
import { Client as Faucet } from "../contracts/faucet/src/index.ts";
import { Client as Store } from "../contracts/store/src/index.ts";
import { Client as Pack } from "../contracts/pack/src/index.ts";
import { Client as Sticker } from "../contracts/sticker/src/index.ts";
import { CONTRACTS, NETWORK_PASSPHRASE, RPC_URL } from "./network";
import { signTransaction } from "./wallet";

function base(contractId: string, publicKey?: string) {
  return {
    contractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey,
    signTransaction,
  };
}

/** Build the contract clients for the connected user (publicKey optional for reads). */
export function makeClients(publicKey?: string) {
  return {
    coin: new Coin(base(CONTRACTS.coin, publicKey)),
    faucet: new Faucet(base(CONTRACTS.faucet, publicKey)),
    store: new Store(base(CONTRACTS.store, publicKey)),
    pack: new Pack(base(CONTRACTS.pack, publicKey)),
    sticker: new Sticker(base(CONTRACTS.sticker, publicKey)),
  };
}
