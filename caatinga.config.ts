import { defineConfig } from "@caatinga/core";

export default defineConfig({
  project: "stellar-album",
  defaultNetwork: "testnet",
  buildRoot: ".",
  contracts: {
    coin: {
      path: "./contracts/coin",
      wasm: "./target/wasm32v1-none/release/coin.wasm",
      deployArgs: {
        admin: "${source.address}",
        minter: "${source.address}",
      },
    },
    sticker: {
      path: "./contracts/sticker",
      wasm: "./target/wasm32v1-none/release/sticker.wasm",
      deployArgs: {
        admin: "${source.address}",
        minter: "${source.address}",
        burner: "${source.address}",
      },
    },
    faucet: {
      path: "./contracts/faucet",
      wasm: "./target/wasm32v1-none/release/faucet.wasm",
      dependsOn: ["coin"],
      deployArgs: {
        admin: "${source.address}",
        coin: "${contracts.coin.contractId}",
        cooldown: 10800,
        seed: 1000,
        drip: 100,
      },
    },
    pack: {
      path: "./contracts/pack",
      wasm: "./target/wasm32v1-none/release/pack.wasm",
      dependsOn: ["sticker"],
      deployArgs: {
        admin: "${source.address}",
        minter: "${source.address}",
        sticker: "${contracts.sticker.contractId}",
      },
    },
    album: {
      path: "./contracts/album",
      wasm: "./target/wasm32v1-none/release/album.wasm",
      dependsOn: ["sticker"],
      deployArgs: {
        admin: "${source.address}",
        sticker: "${contracts.sticker.contractId}",
      },
    },
    store: {
      path: "./contracts/store",
      wasm: "./target/wasm32v1-none/release/store.wasm",
      dependsOn: ["coin", "pack"],
      deployArgs: {
        admin: "${source.address}",
        coin: "${contracts.coin.contractId}",
        pack: "${contracts.pack.contractId}",
        treasury: "${source.address}",
        price: 100,
      },
    },
    escrow: {
      path: "./contracts/escrow",
      wasm: "./target/wasm32v1-none/release/escrow.wasm",
      dependsOn: ["sticker"],
      deployArgs: {
        admin: "${source.address}",
        sticker: "${contracts.sticker.contractId}",
      },
    },
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
  postDeploy: [
    {
      contract: "coin",
      method: "set_minter",
      args: { new_minter: "${contracts.faucet.contractId}" },
    },
    {
      contract: "pack",
      method: "set_minter",
      args: { new_minter: "${contracts.store.contractId}" },
    },
    {
      contract: "sticker",
      method: "set_minter",
      args: { new_minter: "${contracts.pack.contractId}" },
    },
    {
      contract: "sticker",
      method: "set_burner",
      args: { new_burner: "${contracts.album.contractId}" },
    },
  ],
  frontend: {
    framework: "vite-react",
    bindingsOutput: "./frontend/src/contracts",
    envFile: "./frontend/.env.local",
    env: {
      coin: "VITE_COIN",
      faucet: "VITE_FAUCET",
      sticker: "VITE_STICKER",
      pack: "VITE_PACK",
      album: "VITE_ALBUM",
      store: "VITE_STORE",
      escrow: "VITE_ESCROW",
      rpcUrl: "VITE_RPC_URL",
      networkPassphrase: "VITE_NETWORK_PASSPHRASE",
    },
  },
});
