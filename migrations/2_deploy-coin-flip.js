const fs = require("fs-extra");
const path = require("path");
const CoinFlipChainlink = artifacts.require("games/CoinFlipGame");
const CoinFlipSupra = artifacts.require("games/CoinFlipGameSupra");
const FakeUSDCToken = artifacts.require("utils/FakeUSDCToken");
const GamesHub = artifacts.require("GamesHub");

module.exports = async function (deployer, network, accounts) {
  // Read contracts.json
  const variablesPath = path.join(__dirname, "..", "contracts.json");
  const data = JSON.parse(fs.readFileSync(variablesPath, "utf8"));

  /// Initiate GamesHub an token
  const gamesHub = await GamesHub.at(data[network].GAMES_HUB);
  console.log(`GamesHub loaded at ${gamesHub.address}`);

  const fakeToken = await FakeUSDCToken.at(data[network].TOKEN_ADDRESS);

  /// Deploy CoinFlip
  let coinFlip;
  let name;
  let CoinFlip;

  if (data[network].COIN_FLIP === "") {
    console.log(`Deploying CoinFlip...`);

    /// Set CoinFlip Type
    if (data[network].RandomType === "Chainlink") {
      CoinFlip = CoinFlipChainlink;
      name = "COIN_FLIP_CHAINLINK"

      await deployer.deploy(
        CoinFlip,
        data[network].VRF.subscription,
        data[network].VRF.vrfCoordinator,
        data[network].VRF.keyHash,
        data[network].VRF.callbackGasLimit,
        data[network].VRF.confirmations,
        gamesHub.address
      );
    } else {
      CoinFlip = CoinFlipSupra;
      name = "COIN_FLIP_SUPRA"

      await deployer.deploy(
        CoinFlip,
        data[network].VRF.Router,
        data[network].VRF.confirmations,
        gamesHub.address
      );
    }

    coinFlip = await CoinFlip.deployed();
    console.log(`CoinFlip deployed at ${coinFlip.address}`);

    data[network].COIN_FLIP = coinFlip.address;
    fs.writeFileSync(variablesPath, JSON.stringify(data, null, 2));

    console.log(`Setting CoinFlip address to GamesHub...`);
    await gamesHub.setGameContact(
      coinFlip.address,
      web3.utils.sha3(name),
      false
    );

    console.log(`Minting 10000 tokens to CoinFlip...`);
    const tokenSmallUnit = 10000 * 10 ** 6;
    await fakeToken.mint(coinFlip.address, tokenSmallUnit);

  } else {
    console.log(`CoinFlip already deployed at ${data[network].COIN_FLIP}`);
  }
};
