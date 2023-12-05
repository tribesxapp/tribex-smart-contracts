import path from "path";
import solc from "solc";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { execSync } from "child_process";
import dotenv from "dotenv";
import Web3 from "web3";
import HDWalletProvider from "@truffle/hdwallet-provider";
import axios from "axios";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

export const networks = {
  base: {
    web3: new Web3(
      new HDWalletProvider(process.env.PRIVATE_KEY, process.env.BASE_RPC_URL)
    ),
    provider: new HDWalletProvider(
      process.env.PRIVATE_KEY,
      process.env.BASE_RPC_URL
    ),
    chain_id: process.env.BASE_CHAIN_ID,
    lz_chain_id: process.env.BASE_LZ_ID,
    explorer_key: process.env.BASE_BLOCK_EXPLORER_API_KEY,
    explorer_url: process.env.BASE_BLOCK_EXPLORER_API_URL,
  },
  gnosis: {
    web3: new Web3(
      new HDWalletProvider(process.env.PRIVATE_KEY, process.env.GNOSIS_RPC_URL)
    ),
    provider: new HDWalletProvider(
      process.env.PRIVATE_KEY,
      process.env.GNOSIS_RPC_URL
    ),
    chain_id: process.env.GNOSIS_CHAIN_ID,
    lz_chain_id: process.env.GNOSIS_LZ_ID,
    explorer_key: process.env.GNOSIS_BLOCK_EXPLORER_API_KEY,
    explorer_url: process.env.GNOSIS_BLOCK_EXPLORER_API_URL,
  },
  polygon: {
    web3: new Web3(
      new HDWalletProvider(process.env.PRIVATE_KEY, process.env.POLYGON_RPC_URL)
    ),
    provider: new HDWalletProvider(
      process.env.PRIVATE_KEY,
      process.env.POLYGON_RPC_URL
    ),
    chain_id: process.env.POLYGON_CHAIN_ID,
    lz_chain_id: process.env.POLYGON_LZ_ID,
    explorer_key: process.env.POLYGON_BLOCK_EXPLORER_API_KEY,
    explorer_url: process.env.POLYGON_BLOCK_EXPLORER_API_URL,
  },
  arbitrum: {
    web3: new Web3(
      new HDWalletProvider(
        process.env.PRIVATE_KEY,
        process.env.ARBITRUM_RPC_URL
      )
    ),
    provider: new HDWalletProvider(
      process.env.PRIVATE_KEY,
      process.env.ARBITRUM_RPC_URL
    ),
    chain_id: process.env.ARBITRUM_CHAIN_ID,
    lz_chain_id: process.env.ARBITRUM_LZ_ID,
    explorer_key: process.env.ARBITRUM_BLOCK_EXPLORER_API_KEY,
    explorer_url: process.env.ARBITRUM_BLOCK_EXPLORER_API_URL,
  },
  mumbai: {
    web3: new Web3(
      new HDWalletProvider(process.env.PRIVATE_KEY, process.env.MUMBAI_RPC_URL)
    ),
    provider: new HDWalletProvider(
      process.env.PRIVATE_KEY,
      process.env.MUMBAI_RPC_URL
    ),
    chain_id: process.env.MUMBAI_CHAIN_ID,
    lz_chain_id: process.env.MUMBAI_LZ_ID,
    explorer_key: process.env.MUMBAI_BLOCK_EXPLORER_API_KEY,
    explorer_url: process.env.MUMBAI_BLOCK_EXPLORER_API_URL,
  },
  "base-testnet": {
    web3: new Web3(
      new HDWalletProvider(
        process.env.PRIVATE_KEY,
        process.env.BASE_TESTNET_RPC_URL
      )
    ),
    provider: new HDWalletProvider(
      process.env.PRIVATE_KEY,
      process.env.BASE_TESTNET_RPC_URL
    ),
    chain_id: process.env.BASE_TESTNET_CHAIN_ID,
    lz_chain_id: process.env.BASE_TESTNET_LZ_ID,
    explorer_key: process.env.BASE_TESTNET_BLOCK_EXPLORER_API_KEY,
    explorer_url: process.env.BASE_TESTNET_BLOCK_EXPLORER_API_URL,
  },
};

export const sleep = (seconds) => {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

const findImports = (import_path) => {
  let filePath;

  if (import_path.startsWith("@")) {
    filePath = path.join(".", "node_modules", import_path);
  } else {
    filePath = path.join(".", "contracts", import_path);
  }

  try {
    return {
      contents: fs.readFileSync(filePath, "utf8"),
    };
  } catch (e) {
    return { error: "File not found" };
  }
};

function flattenContract(contractPath) {
  try {
    const isWindows = process.platform === "win32";
    const flattenerCommand = isWindows
      ? `npx truffle-flattener ${contractPath}`
      : `./node_modules/.bin/truffle-flattener ${contractPath}`;
    const flattenedCode = execSync(flattenerCommand).toString();

    return flattenedCode;
  } catch (error) {
    console.error("Error flattening contract:", error);
    return null;
  }
}

const estimateGas = async (contractFunction, network) => {
  const web3 = networks[network].web3;
  try {
    const accounts = await web3.eth.getAccounts();
    const gasEstimate = await contractFunction.estimateGas({
      from: accounts[0],
    });
    const gasPrice = await web3.eth.getGasPrice();
    const nonce = await web3.eth.getTransactionCount(accounts[0], "pending");

    return {
      from: accounts[0],
      nonce,
      gas: BigInt(Math.round(Number(gasEstimate) * 1.3)),
      gasPrice: BigInt(Math.round(Number(gasPrice) * 1.3)),
    };
  } catch (e) {
    console.error("An error occurred on estimating GAS:", e);
    return {};
  }
};

const estimateGasForTransfer = async (toAddress, amount, network) => {
  const web3 = networks[network].web3;
  try {
    const accounts = await web3.eth.getAccounts();
    const gasEstimate = await web3.eth.estimateGas({
      from: accounts[0],
      to: toAddress,
      value: web3.utils.toWei(amount, "ether"),
    });
    const gasPrice = await web3.eth.getGasPrice();
    const nonce = await web3.eth.getTransactionCount(accounts[0], "pending");

    return {
      from: accounts[0],
      to: toAddress,
      value: web3.utils.toWei(amount, "ether"),
      nonce,
      gasLimit: BigInt(Math.round(Number(gasEstimate) * 1.3)),
      gasPrice: BigInt(Math.round(Number(gasPrice) * 1.3)),
    };
  } catch (e) {
    console.error("An error occurred on estimating gas for Ether transfer:", e);
    return {};
  }
};

export const sendEther = async (toAddress, amount, network) => {
  const web3 = networks[network].web3;
  try {
    const transactionParams = await estimateGasForTransfer(
      toAddress,
      amount,
      network
    );
    if (!transactionParams.from) {
      throw new Error("Failed to estimate gas");
    }

    const accounts = await web3.eth.getAccounts();
    const nonce = await web3.eth.getTransactionCount(accounts[0], "pending");
    console.log("Nonce:", nonce);
    transactionParams.nonce = nonce;

    await web3.eth.sendTransaction(transactionParams);
    console.log("Transaction successful.");
  } catch (error) {
    console.error("Error sending Ether:", error);
  }
};

const waitForTransactionReceipt = async (txHash, network) => {
  const web3 = networks[network].web3;
  let txReceipt = null;
  while (txReceipt === null) {
    txReceipt = await web3.eth.getTransactionReceipt(txHash);
    if (txReceipt === null) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  return txReceipt;
};

function toFormUrlEncoded(data) {
  return Object.keys(data)
    .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
    .join("&");
}

//Exports
export const checkVerificationStatus = async (guid, network) => {
  while (true) {
    try {
      const response = await axios.get(networks[network].explorer_url, {
        params: {
          apikey: networks[network].explorer_key,
          guid: guid,
          module: "contract",
          action: "checkverifystatus",
        },
      });

      const { message, result } = response.data;

      if (result.startsWith("Pass") || result.startsWith("Fail")) {
        console.log("Verification Result:", result);
        return result;
      } else if (message === "NOTOK" && result === "Pending in queue") {
        console.log("Waiting on queue...");
      } else {
        console.log("Checking verification status...");
      }

      // Sleep for 5 seconds before checking again
      await sleep(5);
    } catch (error) {
      console.error("Error checking verification status:", error);
      throw error;
    }
  }
};

export const verify = async (
  network,
  contractName,
  contractAddress,
  constructorArgs = [],
  libraryAddresses = []
) => {
  const web3 = networks[network].web3;
  let constructorArguements = "0x";
  console.log("Verifying contract:", contractAddress, "on", network);

  if (Array.isArray(constructorArgs) && constructorArgs.length > 0) {
    const encodedArgs = constructorArgs.map((arg) => {
      switch (arg.type) {
        case "number":
          return web3.utils.toHex(arg.value).slice(2).padStart(64, "0");
        case "boolean":
          return web3.utils
            .toHex(arg.value ? 1 : 0)
            .slice(2)
            .padStart(64, "0");
        case "address":
          return arg.value.slice(2).padStart(64, "0");
        case "bytes":
          return web3.utils.toHex(arg.value).slice(2).padStart(64, "0");
        case "string":
          return web3.utils.toHex(arg.value).slice(2);
        default:
          throw new Error(`Unsupported type: ${arg.type}`);
      }
    });

    constructorArguements = encodedArgs.join("");
  }
  if (constructorArguements === "0x") constructorArguements = "";

  const contractPath = path.resolve("contracts", contractName + ".sol");
  const baseContractName = path.basename(contractName, ".sol");
  let fullSource = flattenContract(contractPath);

  fullSource = fullSource.replace(/\/\/ SPDX-License-Identifier: (.+)/g, "");
  fullSource = "// SPDX-License-Identifier: MIT\n\n" + fullSource;

  //write fullSource to a file
  const fullSourcePath = path.resolve(
    __dirname,
    "..",
    "output",
    `${baseContractName}.sol`
  );

  fs.writeFileSync(fullSourcePath, fullSource);

  const data = {
    apikey: networks[network].explorer_key,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: contractAddress,
    sourceCode: fullSource,
    codeformat: "solidity-single-file",
    contractname: baseContractName,
    compilerversion: "v0.8.19+commit.a1b79de6",
    optimizationUsed: 1,
    runs: 200,
    constructorArguements: constructorArguements,
  };

  libraryAddresses.forEach((library, index) => {
    const libraryNameKey = `libraryname${index + 1}`;
    const libraryAddressKey = `libraryaddress${index + 1}`;
    const [libraryName, libraryAddress] = Object.entries(library)[0];

    data[libraryNameKey] = libraryName;
    data[libraryAddressKey] = libraryAddress;
  });

  // return true;

  const response = await axios.post(
    networks[network].explorer_url,
    toFormUrlEncoded(data),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (response.data.status === "1" && response.data.result) {
    console.log("Request successful. GUID:", response.data.result);
    await checkVerificationStatus(response.data.result, network);
    return response.data.result;
  } else {
    console.error(`Waiting to verify contract. Error: ${response.data.result}`);
    return false;
  }
};

export const compile = async (contractName, libraryAddresses = {}) => {
  const contractPath = path.resolve("contracts", contractName + ".sol");
  const source = fs.readFileSync(contractPath, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      [contractName]: {
        content: source,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["*"],
        },
      },
    },
  };

  const output = JSON.parse(
    await solc.compile(JSON.stringify(input), { import: findImports })
  );

  // console.log("Output:", output);

  // This removes the subfolder from the contract name
  const baseContractName = path.basename(contractName);

  const contract = output.contracts[contractName][baseContractName];

  const contractABI = contract.abi || "";
  let contractBytecode = contract.evm.bytecode?.object || "";

  if (contractABI === "" || contractBytecode === "") {
    console.error("Error compiling contract: ", contractName);
    process.exit(1);
  }

  /// Link libraries
  for (const [libraryName, address] of Object.entries(libraryAddresses)) {
    console.log("Linking library: ", libraryName, address);
    const placeholder = `__${libraryName}______________________________________`; // 40 characters
    const libraryAddress = address.replace("0x", "").padStart(40, "0"); // Remove '0x' and left pad to 40 characters
    const regex = new RegExp(placeholder, "g");
    contractBytecode = contractBytecode.replace(regex, libraryAddress);
  }

  // Create the 'abi' folder if it doesn't exist
  const abiDir = path.resolve(__dirname, "..", "abi");
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir);
  }

  // This removes the subfolder from the contract name
  const abiPath = path.resolve(
    abiDir,
    `${baseContractName.replace(".sol", "")}.json`
  );
  fs.writeFileSync(abiPath, JSON.stringify(contractABI, null, 2));
  return [contractABI, contractBytecode, input];
};

export const deploy = async (
  network,
  contractABI,
  contractBytecode,
  constructorArgs = []
) => {
  const web3 = networks[network].web3;
  const accounts = await web3.eth.getAccounts();
  const gasEstimate = await new web3.eth.Contract(contractABI)
    .deploy({ data: "0x" + contractBytecode, arguments: constructorArgs })
    .estimateGas({
      from: accounts[0],
    });

  const gasPrice = await web3.eth.getGasPrice();
  let nonce = await networks[network].web3.eth.getTransactionCount(
    accounts[0],
    "pending"
  );

  // nonce = BigInt(259);

  console.log("Nonce:", nonce);

  const result = await new web3.eth.Contract(contractABI)
    .deploy({ data: "0x" + contractBytecode, arguments: constructorArgs })
    .send({
      from: accounts[0],
      nonce,
      gas: BigInt(Math.round(Number(gasEstimate) * 1.3)),
      gasPrice: BigInt(Math.round(Number(gasPrice) * 1.3)),
    });

  return result.options.address;
};

export const executeFunction = async (
  network,
  methodCall,
  contractAddress,
  etherValue = null
) => {
  const web3 = networks[network].web3;
  try {
    const gasOptions = await estimateGas(methodCall, network);
    if (!gasOptions.gas || !gasOptions.gasPrice) {
      console.error("GAS estimation failed");
      process.exit(1);
    }

    // Building transaction
    const tx = {
      ...gasOptions,
      to: contractAddress,
      data: methodCall.encodeABI(),
    };

    // Add etherValue to the transaction if it is provided
    if (etherValue !== null) {
      tx.value = web3.utils.toWei(etherValue.toString(), "ether");
    }

    // Signing transaction
    const signedTx = await web3.eth.accounts.signTransaction(
      tx,
      process.env.PRIVATE_KEY
    );

    // Sending transaction
    const txInfo = await web3.eth.sendSignedTransaction(
      signedTx.rawTransaction
    );
    const txHash = txInfo.transactionHash;
    console.log("Transaction sent, hash:", txHash);

    // Waiting for transaction receipt
    const txReceipt = await waitForTransactionReceipt(txHash, network);

    return txReceipt;
  } catch (error) {
    console.error("Error in executeFunction:", error);
    process.exit(1);
  }
};
