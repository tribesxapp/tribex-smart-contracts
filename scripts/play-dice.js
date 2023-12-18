const fs = require("fs-extra");
const path = require("path");
const { exit } = require("process");
const DiceChainlink = artifacts.require("games/DiceChainlink");
const DiceSupra = artifacts.require("games/DiceSupra");
const FakeUSDCToken = artifacts.require("utils/FakeUSDCToken");

module.exports = async (deployer, network, accounts) => {
  const networkId = await web3.eth.net.getId();
  console.log(`Network ID: ${networkId}`);

  // Read contracts.json
  const variablesPath = path.join(__dirname, "..", "contracts.json");
  const data = JSON.parse(fs.readFileSync(variablesPath, "utf8"));
  const networkData = data[data.NETWORKS[networkId]];

  const fakeToken = await FakeUSDCToken.deployed();
  console.log(`FakeUSDCToken loaded.`);

  let dice;
  /// Initiate Dice and token
  if (networkData.RandomType === "Chainlink") {
    dice = await DiceChainlink.deployed();
  } else {
    dice = await DiceSupra.deployed();
  }

  console.log(`Dice loaded.`);

  const betAmount = 10;
  const totalGames = 10;
  const amountInSmallestUnit = (BigInt(betAmount) * BigInt(1e6)).toString();
  const amountApproval = (
    BigInt(betAmount * totalGames) * BigInt(1e6)
  ).toString();

  //approve an play
  console.log(`Approving ${betAmount} tokens...`);
  await fakeToken.approve(dice.address, amountApproval);
  for (let i = 0; i < totalGames; i++) {
    console.log(`Playing game ${i + 1}...`);
    await dice.rollDice([5,3,1,0,0], amountInSmallestUnit);
  }
  exit();
};
