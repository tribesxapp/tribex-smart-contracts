const fs = require("fs-extra");
const path = require("path");
const FakeUSDCToken = artifacts.require("utils/FakeUSDCToken");
const GamesHub = artifacts.require("GamesHub");

module.exports = async function (deployer, network, accounts) {
  // Read contracts.json
  const variablesPath = path.join(__dirname, "..", "contracts.json");
  const data = JSON.parse(fs.readFileSync(variablesPath, "utf8"));
  const networkData = data[network];

  /// Deploy GamesHub
  let gamesHub;

  if (networkData.GAMES_HUB === "") {
    console.log(`Deploying GamesHub...`);
    await deployer.deploy(GamesHub);
    gamesHub = await GamesHub.deployed();
    console.log(`GamesHub deployed at ${gamesHub.address}`);

    networkData.GAMES_HUB = gamesHub.address;
    fs.writeFileSync(variablesPath, JSON.stringify(data, null, 2));

    console.log(`Setting Admin Wallet address...`);
    await gamesHub.setGameContact(
      networkData.ADMIN_WALLET,
      web3.utils.sha3("ADMIN_WALLET"),
      true
    );

    console.log(`Setting Treasury address...`);
    await gamesHub.setGameContact(
      networkData.TREASURY,
      web3.utils.sha3("TREASURY"),
      true
    );
  } else {
    gamesHub = await GamesHub.at(networkData.GAMES_HUB);
    console.log(`GamesHub loaded at ${gamesHub.address}`);
  }

  /// Deploy FakeUSDCToken
  let fakeToken;

  if (networkData.TOKEN_ADDRESS === "") {
    console.log(`Deploying FakeUSDCToken...`);
    await deployer.deploy(FakeUSDCToken);
    fakeToken = await FakeUSDCToken.deployed();
    console.log(`FakeUSDCToken deployed at ${fakeToken.address}`);

    networkData.TOKEN_ADDRESS = fakeToken.address;
    fs.writeFileSync(variablesPath, JSON.stringify(data, null, 2));

    console.log(`Setting token address to GamesHub...`);
    await gamesHub.setGameContact(
      fakeToken.address,
      web3.utils.sha3("TOKEN"),
      true
    );
  } else {
    console.log(`FakeUSDCToken already deployed at ${networkData.TOKEN_ADDRESS}`);
  }
};
