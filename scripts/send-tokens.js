const fs = require("fs-extra");
const path = require("path");
const { exit } = require("process");
const FakeUSDCToken = artifacts.require("utils/FakeUSDCToken");

module.exports = async (deployer, network, accounts) => {
  const networkId = await web3.eth.net.getId();
  console.log(`Network ID: ${networkId}`);

  // Read contracts.json
  const variablesPath = path.join(__dirname, "..", "contracts.json");

  const fakeToken = await FakeUSDCToken.deployed();
  console.log(`FakeUSDCToken loaded.`);

  console.log(`Minting 1000 tokens to list...`);
  const addresses = [
    "0x6236B9A8477d934DD1BFC9899BD8a11B8a670AfC", // guelfi
    "0x14aE683317D9d27957F56C78e9308E7D54BC3b36", // Diego
    "0x30dF3855147f73d6981f515A02B2c8Dd2dd00ba2", // me
    "0x42802cB74A221486cb4060AD3b80FbD4866457e7", // Edu
    "0x6815547453B8731A39eB420C11E45D6c685a677C", // Gervickas
  ];
  const tokenSmallUnit = 1000 * 10 ** 6;
  for (let i = 0; i < addresses.length; i++) {
    console.log(`Sending tokens to ${addresses[i]}...`);
    await fakeToken.mint(addresses[i], tokenSmallUnit);
  }
  exit();
};
