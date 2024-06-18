// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CoinFlipGameSupra from Degen OnChain
 * @dev A decentralized coin flip game using Supra Oracles for randomness.
 * 
 * The game allows players to bet on the outcome of a coin flip (heads or tails). 
 * The contract interacts with the Supra Oracles to obtain a random number which determines the result of the coin flip.
 * Solidity Version: 0.8.19 (this version deals automatically with overflows and underflows issues)
 * 
 * ## How the Game Works:
 * 1. **Placing a Bet:**
 *    - Players call the `coinFlip` function, specifying the amount to bet and their choice (heads or tails).
 *    - The bet amount is transferred to the contract, and a small fee (`FEE_FROM_BET`) is deducted and sent to the treasury.
 *    - A request is sent to the Supra Oracles to obtain a random number.
 * 
 * 2. **Determining the Outcome:**
 *    - The Supra Oracles call the `callback` function with the random number.
 *    - The contract determines the outcome of the coin flip based on the random number.
 *    - If the player wins, they receive their bet amount multiplied by 2, minus a fee (`FEE_PERC_FROM_WIN`).
 *    - If the player loses, the bet amount is retained by the contract.
 * 
 * 3. **Fees:**
 *    - `FEE_FROM_BET`: A constant fee deducted from each bet and sent to the treasury.
 *    - `FEE_PERC_FROM_WIN`: A percentage fee deducted from the winnings of a successful bet.
 *    - `keepFees`: A boolean variable indicating whether the fees should be kept by the contract or sent to the treasury.
 * 
 * ## Variables:
 * - `gamesHub`: Interface to the GamesHub contract, used for managing game state and roles.
 * - `token`: Interface to the ERC20 token used for betting.
 * - `totalBet`: The total amount of tokens currently bet in the contract.
 * - `maxLimit`: The maximum bet amount allowed.
 * - `minLimit`: The minimum bet amount allowed.
 * - `totalGames`: The total number of games played.
 * - `games`: A mapping of game nonces to game details.
 * - `gameNonce`: A mapping of Supra Oracles request nonces to game nonces.
 * - `supraAddr`: The address of the Supra Oracles contract.
 * - `deployer`: The address of the contract deployer.
 * - `requestConfirmations`: The number of confirmations required for the Supra Oracles request.
 * 
 * ## Events:
 * - `CoinFlipped`: Emitted when a player places a bet.
 * - `GameFinished`: Emitted when the outcome of a game is determined.
 * - `LimitsChanged`: Emitted when the betting limits are changed.
 * - `GameRefunded`: Emitted when a game is refunded.
 * - `ConfirmationsChanged`: Emitted when the number of confirmations required for the Supra Oracles request is changed.
 * - `KeepFeesChanged`: Emitted when the `keepFees` variable is changed.
 */

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IGamesHub.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/ISupraRouter.sol";

contract CoinFlipGameSupra is ReentrancyGuard {
    event CoinFlipped(
        address indexed player,
        uint256 indexed nonce,
        uint256 indexed rngNonce,
        uint256 creditAmount
    );
    event GameFinished(
        uint256 indexed nonce,
        address indexed player,
        uint256 volumeIn,
        uint256 volumeOut,
        uint8 result,
        bool heads,
        uint256 fee,
        address game
    );
    event LimitsChanged(uint256 maxLimit, uint256 minLimit);
    event GameRefunded(
        uint256 indexed nonce,
        address indexed player,
        uint256 volume
    );

    event ConfirmationsChanged(uint16 _requestConfirmations);

    event KeepFeesChanged(bool _keepFees);

    IGamesHub public gamesHub;
    IERC20 public token;
    uint256 public totalBet;
    uint256 public maxLimit = 1000 * (10 ** 6); //default 1000 USDC
    uint256 public minLimit = 1 * (10 ** 6); //default 1 USDC
    uint256 public constant FEE_FROM_BET = 10 * (10 ** 4); //default 10 cents
    uint8 public constant FEE_PERC_FROM_WIN = 20;
    bool keepFees = false;
    uint256 totalGames = 0;

    struct Games {
        address player;
        uint256 amount;
        bool heads;
        uint8 result; // 0- not set, 1- win, 2- lose, 3- refunded
    }
    mapping(uint256 => Games) public games;
    mapping(uint256 => uint256) gameNonce;

    address private supraAddr;
    address private deployer;
    uint16 public requestConfirmations;

    constructor(
        address supraSC,
        uint16 _requestConfirmations,
        address _gamesHub
    ) {
        gamesHub = IGamesHub(_gamesHub);
        token = IERC20(gamesHub.helpers(keccak256("TOKEN")));
        totalBet = 0;
        supraAddr = supraSC;
        deployer = msg.sender;
        requestConfirmations = _requestConfirmations;
    }

    /**
     * @dev Flip the coin, setting the bet amount and the side of the coin
     * A request will be sent to the SupraOracles contract to get a random number
     * @param _heads Heads or Tails
     * @param _amount Amount of tokens to bet
     */
    function coinFlip(bool _heads, uint256 _amount) external nonReentrant {
        uint256 balance = token.balanceOf(address(this));

        require(_amount <= maxLimit && _amount >= minLimit, "CF-01");
        require(balance >= ((totalBet + _amount) * 2), "CF-02");

        gamesHub.incrementNonce();

        _amount -= FEE_FROM_BET;

        token.transferFrom(msg.sender, address(this), _amount);
        // Sending fee to the house
        token.transferFrom(
            msg.sender,
            gamesHub.helpers(keccak256("TREASURY")),
            FEE_FROM_BET
        );

        games[gamesHub.nonce()] = Games(msg.sender, _amount, _heads, 0);

        uint256 nonce = ISupraRouter(supraAddr).generateRequest(
            "callback(uint256,uint256[])",
            1,
            requestConfirmations,
            deployer
        );
        gameNonce[nonce] = gamesHub.nonce();

        totalBet += _amount;
        totalGames += 1;
        emit CoinFlipped(msg.sender, gamesHub.nonce(), nonce, _amount);
    }

    /**
     * @dev Callback function from the SupraOracles contract
     * @param nonce Nonce of the game
     * @param rngList Random number list
     */
    function callback(
        uint256 nonce,
        uint256[] calldata rngList
    ) external nonReentrant {
        require(msg.sender == supraAddr, "CF-03");
        Games storage game = games[gameNonce[nonce]];
        if (game.result > 0) return;

        uint256 volume = 0;
        uint256 _fee = 0;
        bool heads = (rngList[0] % 2) == 1;

        if ((heads && game.heads) || (!heads && !game.heads)) {
            game.result = 1;
            _fee = (game.amount * FEE_PERC_FROM_WIN) / 1000;
            volume = game.amount - _fee;
            volume += game.amount;
            token.transfer(game.player, volume);
            if (keepFees)
                token.transfer(gamesHub.helpers(keccak256("TREASURY")), _fee);
        } else {
            game.result = 2;
        }
        totalBet -= game.amount;

        emit GameFinished(
            gameNonce[nonce],
            game.player,
            game.amount,
            volume,
            game.result,
            heads,
            _fee,
            address(this)
        );
    }

    /**
     * @dev Refund the game to the player. To use only if some game is stuck.
     * @param _nonce Nonce of the game
     */
    function refundGame(uint256 _nonce) external nonReentrant {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "CF-05");
        Games storage game = games[_nonce];
        require(game.result == 0, "CF-04");

        token.transfer(game.player, game.amount);
        totalBet -= game.amount;
        game.amount = 0;

        //changing result to refunded
        game.result = 3;

        emit GameRefunded(_nonce, game.player, game.amount);
    }

    /**
     * @dev Change the bet limits
     * @param _maxLimit maximum bet limit
     * @param _minLimit minimum bet limit
     */
    function changeLimits(uint256 _maxLimit, uint256 _minLimit) public {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "CF-05");
        require(_maxLimit >= _minLimit, "CF-06");
        require(_minLimit > FEE_FROM_BET, "CF-08");

        maxLimit = _maxLimit;
        minLimit = _minLimit;

        emit LimitsChanged(_minLimit, _maxLimit);
    }

    /**
     * @dev Change the number of confirmations required for the request
     * @param _requestConfirmations Number of confirmations
     */
    function changeConfirmations(uint16 _requestConfirmations) public {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "CF-05");
        requestConfirmations = _requestConfirmations;
        emit ConfirmationsChanged(_requestConfirmations);
    }

    /**
     * @dev Change the keepFees variable
     * @param _keepFees New value for keepFees
     */
    function changeKeepFees(bool _keepFees) public {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "CF-05");
        keepFees = _keepFees;

        emit KeepFeesChanged(_keepFees);
    }

    /**
     * @dev Change the token address, sending the current token balance to the admin wallet
     * It's only possible if there are no games in progress
     * @param _token New token address
     */
    function changeToken(address _token) public nonReentrant {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "CF-05");
        require(totalBet == 0, "CF-07");

        token.transfer(gamesHub.adminWallet(), token.balanceOf(address(this)));
        token = IERC20(_token);
    }

    /**
     * @dev Withdraw tokens from the contract to the admin wallet
     * It's only possible if there are no games in progress
     * @param _amount Amount of tokens to withdraw
     */
    function withdrawTokens(uint256 _amount) public nonReentrant {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "CF-05");
        require(totalBet == 0, "CF-07");

        token.transfer(gamesHub.adminWallet(), _amount);
    }
}
