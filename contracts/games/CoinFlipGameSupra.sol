// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IGamesHub.sol";
import "../interfaces/IERC20.sol";

interface ISupraRouter {
    function generateRequest(
        string memory _functionSig,
        uint8 _rngCount,
        uint256 _numConfirmations,
        uint256 _clientSeed,
        address _clientWalletAddress
    ) external returns (uint256);

    function generateRequest(
        string memory _functionSig,
        uint8 _rngCount,
        uint256 _numConfirmations,
        address _clientWalletAddress
    ) external returns (uint256);
}

contract CoinFlipGameSupra {
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
        uint256 randomness,
        bool heads
    );
    event LimitsAndChancesChanged(
        uint256 maxLimit,
        uint256 minLimit,
        bool limitTypeFixed,
        uint8 feeFromBet,
        uint8 feePercFromWin
    );
    event GameRefunded(
        uint256 indexed nonce,
        address indexed player,
        uint256 volume
    );

    event ConfirmationsChanged(uint16 _requestConfirmations);

    IGamesHub public gamesHub;
    IERC20 public token;
    uint256 public totalBet;
    uint256 public maxLimit = 1000 * (10 ** 6); //default 1000 USDC
    uint256 public minLimit = 1 * (10 ** 6); //default 1 USDC
    uint256 public feeFromBet = 7 * (10 ** 4); //default 7 cents
    uint8 public feePercFromWin = 15;
    bool limitTypeFixed = true;
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
    function coinFlip(bool _heads, uint256 _amount) external {
        uint256 balance = token.balanceOf(address(this));

        if (limitTypeFixed) {
            require(_amount <= maxLimit && _amount >= minLimit, "CF-01");
        } else {
            require(
                _amount <= (maxLimit * balance) / 100 &&
                    _amount >= (minLimit * balance) / 100,
                "CF-01"
            );
        }

        require(balance >= ((totalBet + _amount) * 2), "CF-02");

        gamesHub.incrementNonce();

        _amount -= feeFromBet;

        token.transferFrom(msg.sender, address(this), _amount);
        // Sending fee to the house
        token.transferFrom(
            msg.sender,
            gamesHub.helpers(keccak256("TREASURY")),
            feeFromBet
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
    function callback(uint256 nonce, uint256[] calldata rngList) external {
        require(msg.sender == supraAddr, "CF-03");
        Games storage game = games[gameNonce[nonce]];
        if (game.result > 0) return;

        uint256 volume = 0;
        bool heads = (rngList[0] % 2) == 1;

        if ((heads && game.heads) || (!heads && !game.heads)) {
            game.result = 1;
            uint256 _fee = (game.amount * feePercFromWin) / 1000;
            volume = game.amount - _fee;
            volume += game.amount;
            token.transfer(game.player, volume);
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
            rngList[0],
            heads
        );
    }

    /**
     * @dev Refund the game to the player. To use only if some game is stuck.
     * @param _nonce Nonce of the game
     */
    function refundGame(uint256 _nonce) external {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "CF-05");
        Games storage game = games[_nonce];
        require(game.result == 0, "CF-04");

        token.transfer(game.player, game.amount);
        totalBet -= game.amount;
        game.amount = 0;
        game.result = 3;

        emit GameRefunded(_nonce, game.player, game.amount);
    }

    /**
     * @dev Change the house chance and bet limit
     * @param _maxLimit maximum bet limit
     * @param _minLimit minimum bet limit
     * @param _limitTypeFixed if true, the bet limit will be fixed, if false, the bet limit will be a percentage of the contract balance
     * @param _feeFromBet fee from the bet
     * @param _feePercFromWin fee percentage from the win
     */
    function changeLimitsAndChances(
        uint256 _maxLimit,
        uint256 _minLimit,
        bool _limitTypeFixed,
        uint8 _feeFromBet,
        uint8 _feePercFromWin
    ) public {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "CF-05");
        require(_maxLimit >= _minLimit, "CF-06");
        require(_feePercFromWin <= 500, "CF-08");

        if (!limitTypeFixed) {
            require(_maxLimit <= 100 && _minLimit <= 100, "CF-12");
        }

        maxLimit = _maxLimit;
        minLimit = _minLimit;
        limitTypeFixed = _limitTypeFixed;
        feeFromBet = _feeFromBet;
        feePercFromWin = _feePercFromWin;

        emit LimitsAndChancesChanged(
            _minLimit,
            _maxLimit,
            _limitTypeFixed,
            _feeFromBet,
            _feePercFromWin
        );
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
     * @dev Change the token address, sending the current token balance to the admin wallet
     * @param _token New token address
     */
    function changeToken(address _token) public {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "CF-05");
        require(totalBet == 0, "CF-07");

        token.transfer(gamesHub.adminWallet(), token.balanceOf(address(this)));
        token = IERC20(_token);
    }

    /**
     * @dev Withdraw tokens from the contract to the admin wallet
     * @param _amount Amount of tokens to withdraw
     */
    function withdrawTokens(uint256 _amount) public {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "CF-05");
        require(totalBet == 0, "CF-07");

        token.transfer(gamesHub.adminWallet(), _amount);
    }
}
