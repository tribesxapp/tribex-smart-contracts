const fs = require("fs-extra");
const path = require("path");
const FakeUSDCToken = artifacts.require("utils/FakeUSDCToken");
const GamesHub = artifacts.require("GamesHub");

module.exports = async function (deployer, network, accounts) {
  // Read contracts.json
  const variablesPath = path.join(__dirname, "..", "contracts.json");
  const data = JSON.parse(fs.readFileSync(variablesPath, "utf8"));

  /// Deploy GamesHub
  let gamesHub;

  if (data[network].GAMES_HUB === "") {
    console.log(`Deploying GamesHub...`);
    await deployer.deploy(GamesHub);
    gamesHub = await GamesHub.deployed();
    console.log(`GamesHub deployed at ${gamesHub.address}`);

    data[network].GAMES_HUB = gamesHub.address;
    fs.writeFileSync(variablesPath, JSON.stringify(data, null, 2));

    console.log(`Setting Admin Wallet address...`);
    await gamesHub.setGameContact(
      data[network].ADMIN_WALLET,
      web3.utils.sha3("ADMIN_WALLET"),
      true
    );

    console.log(`Setting Treasury address...`);
    await gamesHub.setGameContact(
      data[network].TREASURY,
      web3.utils.sha3("TREASURY"),
      true
    );
  } else {
    gamesHub = await GamesHub.at(data[network].GAMES_HUB);
    console.log(`GamesHub loaded at ${gamesHub.address}`);
  }

  /// Deploy FakeUSDCToken
  let fakeToken;

  if (data[network].TOKEN_ADDRESS === "") {
    console.log(`Deploying FakeUSDCToken...`);
    await deployer.deploy(FakeUSDCToken);
    fakeToken = await FakeUSDCToken.deployed();
    console.log(`FakeUSDCToken deployed at ${fakeToken.address}`);

    data[network].TOKEN_ADDRESS = fakeToken.address;
    fs.writeFileSync(variablesPath, JSON.stringify(data, null, 2));

    console.log(`Setting token address to GamesHub...`);
    await gamesHub.setGameContact(
      fakeToken.address,
      web3.utils.sha3("TOKEN"),
      true
    );
  } else {
    console.log(`FakeUSDCToken already deployed at ${data[network].TOKEN_ADDRESS}`);
  }
};
