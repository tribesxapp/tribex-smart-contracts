const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config();

const privateKey = process.env.PRIVATE_KEY; 
const mumbaiRpcUrl = process.env.MUMBAI_RPC_URL;
const polygonRpcUrl = process.env.POLYGON_RPC_URL;
const baseRpcUrl = process.env.BASE_RPC_URL;

module.exports = {
  networks: {
    base: {
      provider: () => new HDWalletProvider(privateKey, baseRpcUrl),
      network_id: 8453,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    mumbai: {
      provider: () => new HDWalletProvider(privateKey, mumbaiRpcUrl),
      network_id: 80001,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    polygon: {
      provider: () => new HDWalletProvider(privateKey, polygonRpcUrl),
      network_id: 137,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    arbitrum: {
      provider: () => new HDWalletProvider(privateKey, polygonRpcUrl),
      network_id: 42161,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    }
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
    basescan: process.env.BASE_BLOCK_EXPLORER_API_KEY
  },

  mocha: {
    // timeout: 100000
  },

  db: {
    enabled: false,
  },
};
