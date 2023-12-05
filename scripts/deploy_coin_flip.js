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

  //// DEPLOY CoinFlipGame ////
  console.log(`Compiling CoinFlipGame...`);

  const [coinFlipABI, coinFlipBytecode] = await compile("games/CoinFlipGame");

  console.log(`Deploying CoinFlipGame on ${network}...`);
  const coinFlipAddress = await deploy(network, coinFlipABI, coinFlipBytecode, [
    contractsJson["Chainlink"][network]["subscription"],
    networks[network].web3.utils.toChecksumAddress(
      contractsJson["Chainlink"][network]["vrfCoordinator"]
    ),
    contractsJson["Chainlink"][network]["keyHash"],
    contractsJson["Chainlink"][network]["callbackGasLimit"],
    contractsJson["Chainlink"][network]["confirmations"],
    networks[network].web3.utils.toChecksumAddress(
      contractsJson["GAMES_HUB"][network]
    ),
  ]);

  let propagated = false;
  while (!propagated) {
    propagated = await verify(network, "games/CoinFlipGame", coinFlipAddress, [
      {
        type: "number",
        value: contractsJson["Chainlink"][network]["subscription"],
      },
      {
        type: "address",
        value: networks[network].web3.utils.toChecksumAddress(
          contractsJson["Chainlink"][network]["vrfCoordinator"]
        ),
      },
      {
        type: "bytes",
        value: contractsJson["Chainlink"][network]["keyHash"],
      },
      {
        type: "number",
        value: contractsJson["Chainlink"][network]["callbackGasLimit"],
      },
      {
        type: "number",
        value: contractsJson["Chainlink"][network]["confirmations"],
      },
      {
        type: "address",
        value: networks[network].web3.utils.toChecksumAddress(
          contractsJson["GAMES_HUB"][network]
        ),
      },
    ]);
    await sleep(5);
  }

  console.log("Deploy finalized: ", coinFlipAddress);

  contractsJson["COIN_FLIP"][network] = coinFlipAddress;

  fs.writeFileSync("contracts.json", JSON.stringify(contractsJson, null, 2));

  //// ADD CoinFlipGame TO GAMES HUB ////
  console.log("Initializing GamesHub...");

  const gamesHubAddress = contractsJson["GAMES_HUB"][network];

  const gamesHubABI = JSON.parse(
    await fs.readFile(path.resolve(__dirname, "../abi/GamesHub.json"), "utf8")
  );

  const gamesHub = new networks[network].web3.eth.Contract(
    gamesHubABI,
    gamesHubAddress
  );

  console.log("Adding CoinFlipGame to Hub...", coinFlipAddress);

  await executeFunction(
    network,
    gamesHub.methods.setGameContact(
      networks[network].web3.utils.toChecksumAddress(coinFlipAddress), // game contract address
      networks[network].web3.utils.sha3("COIN_FLIP"), // game name
      false // is it a helper contract?
    ),
    gamesHubAddress
  );

  process.exit(0);
};

main().catch(console.error);
