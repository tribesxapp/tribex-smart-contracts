import fs from "fs-extra";
import path from "path";

import {
  networks,
  executeFunction,
  __dirname,
} from "./utils.js";

const main = async () => {
  const network = "mumbai";
  let contractsJson = JSON.parse(await fs.readFile("contracts.json", "utf8"));

  //// Initializing Token ////
  console.log("Initializing Token...");

  const tokenAddress = contractsJson["TOKEN_ADDRESS"][network];

  const tokenABI = JSON.parse(
    await fs.readFile(path.resolve(__dirname, "../abi/ERC20.json"), "utf8")
  );

  const token = new networks[network].web3.eth.Contract(tokenABI, tokenAddress);

  //// Initializing COIN_FLIP ////
  console.log("Initializing CoinFlipGame...");

  const coinFlipAddress = contractsJson["COIN_FLIP"][network];

  const coinFlipABI = JSON.parse(
    await fs.readFile(
      path.resolve(__dirname, "../abi/CoinFlipGame.json"),
      "utf8"
    )
  );

  const coinFlip = new networks[network].web3.eth.Contract(
    coinFlipABI,
    coinFlipAddress
  );

  const betAmount = 10;
  const amountInSmallestUnit = (BigInt(betAmount) * BigInt(1e6)).toString();
  ///run 20x
  for (let i = 0; i < 20; i++) {
    console.log(`Game ${i + 1}`);
    //approve
    console.log(`Approving ${betAmount} tokens...`);
    await executeFunction(
      network,
      token.methods.approve(
        networks[network].web3.utils.toChecksumAddress(coinFlipAddress),
        amountInSmallestUnit
      ),
      tokenAddress
    );

    //play on "function coinFlip(bool _headsUp, uint256 _amount) public returns (uint256)" and get the return value
    console.log(`Playing coin flip with ${betAmount} tokens...`);
    const txReceipt = await executeFunction(
      network,
      coinFlip.methods.coinFlip(true, amountInSmallestUnit),
      coinFlipAddress
    );
  }

  const events = await coinFlip.getPastEvents("allEvents", {fromBlock: 43186754, toBlock: "latest"});
  events.forEach((event) => console.log(event.event));

  process.exit(0);
};

main().catch(console.error);
