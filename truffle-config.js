import HDWalletProvider from "@truffle/hdwallet-provider";
import dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.RPC_URL;

if (!privateKey || !rpcUrl) {
  throw new Error("PRIVATE_KEY or RPC_URL not found in environment variables");
}

const config = {
  networks: {
    development: {
      host: "127.0.0.1",     
      port: 7545,            
      network_id: "*",       
    },
    mumbai: {
      provider: () => new HDWalletProvider(privateKey, rpcUrl),
      network_id: 80001,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true
    },
  },

  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
      }
    }
  },

  mocha: {
    // timeout: 100000
  },

  db: {
    enabled: false
  }
};

export default config;
