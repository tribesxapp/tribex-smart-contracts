import fs from "fs-extra";
import path from "path";

import {
  networks,
  sleep,
  compile,
  deploy,
  verify,
  executeFunction,
  __dirname,
} from "./utils.js";

const main = async () => {
  const network = "mumbai";
  let contractsJson = JSON.parse(await fs.readFile("contracts.json", "utf8"));

  //// ADD ADMIN WALLETs TO GAMES HUB ////
  console.log("Initializing GamesHub...");

  const gamesHubAddress = contractsJson["GAMES_HUB"][network];

  const gamesHubABI = JSON.parse(
    await fs.readFile(path.resolve(__dirname, "../abi/GamesHub.json"), "utf8")
  );

  const gamesHub = new networks[network].web3.eth.Contract(
    gamesHubABI,
    gamesHubAddress
  );

  console.log(
    "Adding ADMIN_WALLET to Hub...",
    contractsJson["ADMIN_WALLET"][network]
  );

  await executeFunction(
    network,
    gamesHub.methods.setGameContact(
      networks[network].web3.utils.toChecksumAddress(
        contractsJson["ADMIN_WALLET"][network]
      ), // wallet address
      networks[network].web3.utils.sha3("ADMIN_WALLET"), // name
      true // is it a helper contract?
    ),
    gamesHubAddress
  );

  console.log(
    "Adding TREASURY to Hub...",
    contractsJson["ADMIN_WALLET"][network]
  );

  await executeFunction(
    network,
    gamesHub.methods.setGameContact(
      networks[network].web3.utils.toChecksumAddress(
        contractsJson["TREASURY"][network]
      ), // wallet address
      networks[network].web3.utils.sha3("TREASURY"), // name
      true // is it a helper contract?
    ),
    gamesHubAddress
  );

  //// Funding Supra Contract ////

  // const depositContractAddress =
  //   contractsJson["SupraOracles"][network]["DepositContract"];

  // console.log("Funding Supra Contract...", depositContractAddress);

  // const abiAddress = path.resolve(
  //   __dirname,
  //   "../abi/SupraDepositContract.json"
  // );

  // const depositContract = new networks[network].web3.eth.Contract(
  //   JSON.parse(await fs.readFile(abiAddress, "utf8")),
  //   depositContractAddress
  // );

  // console.log("Funding Supra Contract...");
  // await executeFunction(
  //   network,
  //   depositContract.methods.depositFundClient(),
  //   depositContractAddress,
  //   "0.1033"
  // );

  process.exit(0);
};

main().catch(console.error);
