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

  //// DEPLOY GamesHub ////
  console.log(`Compiling GamesHub...`);

  const [gamesHubABI, gamesHubBytecode] = await compile("GamesHub");

  console.log(`Deploying GamesHub on ${network}...`);
  const gamesHubAddress = await deploy(network, gamesHubABI, gamesHubBytecode);

  let propagated = false;
  while (!propagated) {
    propagated = await verify(network, "GamesHub", gamesHubAddress);
    await sleep(5);
  }

  console.log("Deploy finalized: ", gamesHubAddress);

  contractsJson["GAMES_HUB"][network] = gamesHubAddress;

  fs.writeFileSync("contracts.json", JSON.stringify(contractsJson, null, 2));

  //// ADD FakeUSDCToken TO GAMES HUB ////
  console.log("Initializing GamesHub...");
  const gamesHub = new networks[network].web3.eth.Contract(
    gamesHubABI,
    gamesHubAddress
  );

  console.log("Adding FakeUSDCToken to Hub...", contractsJson["TOKEN_ADDRESS"][network]);

  await executeFunction(
    network,
    gamesHub.methods.setGameContact(
      networks[network].web3.utils.toChecksumAddress(
        contractsJson["TOKEN_ADDRESS"][network]
      ), // game contract address
      networks[network].web3.utils.sha3("TOKEN"), // game name
      true // is it a helper contract?
    ),
    gamesHubAddress
  );

  process.exit(0);
};

main().catch(console.error);
