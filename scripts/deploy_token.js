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

  //// DEPLOY FakeUSDCToken ////
  console.log(`Compiling FakeUSDCToken...`);

  const [fakeTokenABI, fakeTokenBytecode] = await compile(
    "utils/FakeUSDCToken"
  );

  console.log(`Deploying FakeUSDCToken on ${network}...`);
  const fakeTokenAddress = await deploy(
    network,
    fakeTokenABI,
    fakeTokenBytecode
  );

  let propagated = false;
  while (!propagated) {
    propagated = await verify(network, "utils/FakeUSDCToken", fakeTokenAddress);
    await sleep(5);
  }

  console.log("Deploy finalized: ", fakeTokenAddress);

  contractsJson["TOKEN_ADDRESS"][network] = fakeTokenAddress;

  fs.writeFileSync("contracts.json", JSON.stringify(contractsJson, null, 2));

  process.exit(0);
};

main().catch(console.error);
