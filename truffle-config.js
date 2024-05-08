const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config();

const privateKey = process.env.PRIVATE_KEY;

module.exports = {
  networks: {
    base: {
      provider: () => new HDWalletProvider(privateKey, process.env.BASE_RPC_URL),
      network_id: 8453,
      gasPrice: 300000000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    mumbai: {
      provider: () => new HDWalletProvider(privateKey, process.env.MUMBAI_RPC_URL),
      network_id: 80001,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    polygon: {
      provider: () => new HDWalletProvider(privateKey, process.env.POLYGON_RPC_URL),
      network_id: 137,
      gasPrice: 150000000000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    arbitrum: {
      provider: () => new HDWalletProvider(privateKey, process.env.ARBITRUM_RPC_URL),
      network_id: 42161,
      gasPrice: 150000000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },

  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
  plugins: ["truffle-plugin-verify"],

  api_keys: {
    polygonscan: process.env.POLYGON_BLOCK_EXPLORER_API_KEY,
    arbiscan: process.env.ARBITRUM_BLOCK_EXPLORER_API_KEY,
    basescan: process.env.BASE_BLOCK_EXPLORER_API_KEY,
  },

  mocha: {
    // timeout: 100000
  },

  db: {
    enabled: false,
  },
};
