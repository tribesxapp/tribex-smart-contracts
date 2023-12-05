import fs from "fs-extra";
import path from "path";

import { networks, executeFunction, __dirname } from "./utils.js";

const main = async () => {
  const network = "mumbai";
  let contractsJson = JSON.parse(await fs.readFile("contracts.json", "utf8"));

  //// Initializing LzGetRandomNumber ////
  console.log("Initializing TOKEN_ADDRESS...");

  const tokenAddress = contractsJson["TOKEN_ADDRESS"][network];

  const tokenABI = JSON.parse(
    await fs.readFile(path.resolve(__dirname, "../abi/ERC20.json"), "utf8")
  );

  const token = new networks[network].web3.eth.Contract(tokenABI, tokenAddress);

  const addresses = [
    "0x6236B9A8477d934DD1BFC9899BD8a11B8a670AfC", // guelfi
    "0x14aE683317D9d27957F56C78e9308E7D54BC3b36", // Diego
    "0x30dF3855147f73d6981f515A02B2c8Dd2dd00ba2", // me
    "0x778B221D6dF7Cd9fB00dE2c108a77422ade9BB61", // Edu
    "0x6815547453B8731A39eB420C11E45D6c685a677C", // Gervickas
    contractsJson["COIN_FLIP"][network], //Coinflip
  ];

  for (let i = 0; i < addresses.length; i++) {
    console.log(`Sending tokens to ${addresses[i]}...`);
    let amountTokens = i === addresses.length - 1 ? "10000" : "1000";
    let amountInSmallestUnit = (BigInt(amountTokens) * BigInt(1e6)).toString(); // Convert to smallest unit for 6 decimals

    await executeFunction(
      network,
      token.methods.mint(
        networks[network].web3.utils.toChecksumAddress(addresses[i]),
        amountInSmallestUnit
      ),
      tokenAddress
    );
  }

  process.exit(0);
};

main().catch(console.error);
